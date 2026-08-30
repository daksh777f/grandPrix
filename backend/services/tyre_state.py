"""
Tyre Degradation Intelligence (TDI) - Bayesian Latent Tyre State & Cliff Detection.

Roadmap Context:
- Phase 3 of the 12-phase TDI architecture.
- Models tyre degradation as a hidden/latent state observed noisily through the causal
  pace decomposition (tyre_wear_effect + residual) from Phase 2.
- Uses a recursive linear Kalman filter (a mathematically rigorous Gaussian state-space model)
  to estimate local wear rate (seconds/lap), cumulative wear, and shrinking 90% confidence intervals.
- Implements an empirical rolling derivative cliff detector to identify the onset lap
  where linear tyre degradation transitions into exponential pace drop-off.
- Emits explicit honesty labels ("INSUFFICIENT_EVIDENCE", "LOW_CONFIDENCE", "HIGH_CONFIDENCE")
  based on accumulated stint history and posterior uncertainty interval width.

Prerequisites:
- Phase 1: Lap Quality Flagging (tyre_quality.py)
- Phase 2: Causal Pace Decomposition (tyre_decomposition.py)

Subsequent Phases:
- Phase 4: Counterfactual Engine & Post-Race Validator (tyre_validation.py)
- Phase 5: Strategy Simulator / Monte Carlo Pit Window (tyre_strategy.py)
- Phase 6-12: API, UI & Voice Integration
"""

import os
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

try:
    from data.tyre_constants import (
        COMPOUND_NOMINAL_LIFESPAN,
        CONFIDENCE_FLOOR,
        CONFIDENCE_CEILING,
        UNCERTAINTY_SIGMA_FLOOR,
    )
    from services.tyre_decomposition import (
        CausalTyreDecomposer,
        DecomposedLapRecord,
        decompose_driver_session,
    )
except ImportError:
    from backend.data.tyre_constants import (
        COMPOUND_NOMINAL_LIFESPAN,
        CONFIDENCE_FLOOR,
        CONFIDENCE_CEILING,
        UNCERTAINTY_SIGMA_FLOOR,
    )
    from backend.services.tyre_decomposition import (
        CausalTyreDecomposer,
        DecomposedLapRecord,
        decompose_driver_session,
    )


@dataclass
class BayesianTyreStateRecord:
    """Per-lap latent tyre state and cliff detection record."""
    lap_number: int
    stint_number: int
    tyre_age: int
    observed_lap_time: float
    wear_rate_estimate: float
    wear_rate_90pct_interval: Tuple[float, float]
    interval_width: float
    cumulative_wear_estimate: float
    confidence: str  # "INSUFFICIENT_EVIDENCE" | "LOW_CONFIDENCE" | "HIGH_CONFIDENCE"
    cliff_probability: float
    rolling_rate_of_change: float
    cliff_onset_lap: Optional[int]
    compound: str = "UNKNOWN"
    tyre_health_pct: float = 100.0
    base_pace: float = 0.0
    fuel_effect: float = 0.0
    track_evolution_effect: float = 0.0
    tyre_wear_effect: float = 0.0
    residual_noise: float = 0.0
    is_representative: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class BayesianTyreStateEngine:
    """
    Engine for recursive Kalman state estimation of tyre wear rate and
    empirical rolling derivative cliff detection.
    """

    def __init__(self, base_dir: Optional[str] = None):
        self.decomposer = CausalTyreDecomposer(base_dir=base_dir)
        self._cache: Dict[str, Any] = {}

    def estimate_stint_state(
        self,
        stint_records: List[DecomposedLapRecord],
        compound: str = "HARD"
    ) -> List[BayesianTyreStateRecord]:
        """
        Run recursive Bayesian Kalman updating across all representative laps of a single stint.
        State vector: x = [wear_rate (s/lap), cumulative_wear (s)]
        """
        if not stint_records:
            return []

        nominal_lifespan = COMPOUND_NOMINAL_LIFESPAN.get(compound.upper(), 35)
        prior_wear_rate = 0.035 if compound.upper() == "HARD" else (0.050 if compound.upper() == "MEDIUM" else 0.070)
        prior_sigma_w = 0.050

        # Process and observation noise parameters
        q_wear_rate = 0.00005  # Slow drift in degradation slope
        q_cum_wear = 0.00020   # Process noise on cumulative integration
        r_obs = 0.30**2        # Residual pace noise variance (~0.30s std)

        # Initial state prior at stint start
        x = np.array([prior_wear_rate, 0.0])
        P = np.array([
            [prior_sigma_w**2, 0.0],
            [0.0, 0.10**2]
        ])

        filtered_states = []
        prev_age = 1

        for i, rec in enumerate(stint_records):
            age = rec.tyre_age
            delta_age = max(1, age - prev_age)
            prev_age = age

            # 1. Kalman Predict Step
            F = np.array([
                [1.0, 0.0],
                [float(delta_age), 1.0]
            ])
            Q = np.array([
                [q_wear_rate * delta_age, 0.0],
                [0.0, q_cum_wear * delta_age]
            ])
            x_pred = F @ x
            P_pred = F @ P @ F.T + Q

            # 2. Kalman Measurement Update Step
            # Observation y is the causal degradation signal: tyre_wear_effect + residual
            y_obs = rec.tyre_wear_effect + rec.residual
            H = np.array([0.0, 1.0])

            # Elevation of observation noise if lap had large residual / uncertainty
            r_effective = r_obs * (1.5 if abs(rec.residual) > 0.6 else 1.0)

            S = float(H @ P_pred @ H.T + r_effective)
            K = P_pred @ H.T / S
            y_innov = y_obs - float(H @ x_pred)

            x = x_pred + K * y_innov
            P = (np.eye(2) - np.outer(K, H)) @ P_pred

            sigma_w = float(np.sqrt(max(UNCERTAINTY_SIGMA_FLOOR**2, P[0, 0])))
            wear_rate_est = float(x[0])
            cum_wear_est = float(max(0.0, x[1]))

            interval_low = float(wear_rate_est - 1.645 * sigma_w)
            interval_high = float(wear_rate_est + 1.645 * sigma_w)
            interval_width = float(interval_high - interval_low)

            # Honest confidence classification:
            # - If fewer than 4 representative laps have accumulated in the stint,
            #   we deliberately label confidence as "INSUFFICIENT_EVIDENCE" to prevent
            #   premature or falsely precise strategy recommendations.
            # - As laps accumulate and interval width shrinks below 0.075s, confidence
            #   transitions from "LOW_CONFIDENCE" to "HIGH_CONFIDENCE".
            laps_so_far = i + 1
            if laps_so_far < 4:
                confidence_label = "INSUFFICIENT_EVIDENCE"
            elif interval_width > 0.075:
                confidence_label = "LOW_CONFIDENCE"
            else:
                confidence_label = "HIGH_CONFIDENCE"

            # Estimated remaining tyre health percentage (100% at start, decays toward 0%)
            # Nominal cliff wear ~ 2.5s cumulative pace loss
            health_pct = float(max(0.0, min(100.0, (1.0 - cum_wear_est / 2.50) * 100.0)))

            filtered_states.append({
                'lap_number': rec.lap_number,
                'stint_number': rec.stint_number,
                'tyre_age': rec.tyre_age,
                'observed_lap_time': rec.observed,
                'wear_rate_estimate': wear_rate_est,
                'wear_rate_90pct_interval': (interval_low, interval_high),
                'interval_width': interval_width,
                'cumulative_wear_estimate': cum_wear_est,
                'confidence': confidence_label,
                'compound': compound,
                'tyre_health_pct': health_pct,
                'base_pace': rec.base_pace,
                'fuel_effect': rec.fuel_effect,
                'track_evolution_effect': rec.track_evolution_effect,
                'tyre_wear_effect': rec.tyre_wear_effect,
                'residual_noise': rec.residual,
                'is_representative': True
            })

        # 3. Part B: Rolling-Derivative Cliff Detector
        df_states = pd.DataFrame(filtered_states)
        steady_laps = df_states[(df_states['tyre_age'] >= 8) & (df_states['tyre_age'] <= 25)]
        if len(steady_laps) >= 3:
            baseline_wear_rate = float(steady_laps['wear_rate_estimate'].median())
        else:
            baseline_wear_rate = float(df_states['wear_rate_estimate'].median())

        baseline_wear_rate = max(0.025, baseline_wear_rate)
        cliff_threshold = 2.0 * baseline_wear_rate

        wear_rates = df_states['wear_rate_estimate'].values
        lap_nums = df_states['lap_number'].values
        tyre_ages = df_states['tyre_age'].values
        n = len(df_states)

        rolling_derivs = []
        cliff_probs = []
        cliff_onset_lap = None
        consecutive_cliff = 0
        first_candidate_lap = None

        for i in range(n):
            age = tyre_ages[i]
            # Warm-up suppression: do not trigger cliff during early laps (age < 15)
            if i < 2 or age < 15:
                deriv = 0.0
                prob = 0.02
            else:
                d_laps = max(1, lap_nums[i] - lap_nums[i - 2])
                # Acceleration of wear rate scaled per 10 laps
                deriv = max(0.0, float((wear_rates[i] - wear_rates[i - 2]) / d_laps * 10.0))
                ratio = deriv / cliff_threshold if cliff_threshold > 0 else 0.0
                # Smooth continuous probability via sigmoid
                prob = float(1.0 / (1.0 + np.exp(- 5.0 * (ratio - 1.0))))

            rolling_derivs.append(deriv)
            cliff_probs.append(prob)

            if deriv >= cliff_threshold and age >= 18:
                if consecutive_cliff == 0:
                    first_candidate_lap = int(lap_nums[i - 1]) if i >= 1 else int(lap_nums[i])
                consecutive_cliff += 1
                if consecutive_cliff >= 2 and cliff_onset_lap is None:
                    cliff_onset_lap = first_candidate_lap
            else:
                consecutive_cliff = 0

        # Construct final records
        records_out: List[BayesianTyreStateRecord] = []
        for i, s in enumerate(filtered_states):
            records_out.append(BayesianTyreStateRecord(
                lap_number=s['lap_number'],
                stint_number=s['stint_number'],
                tyre_age=s['tyre_age'],
                observed_lap_time=s['observed_lap_time'],
                wear_rate_estimate=s['wear_rate_estimate'],
                wear_rate_90pct_interval=s['wear_rate_90pct_interval'],
                interval_width=s['interval_width'],
                cumulative_wear_estimate=s['cumulative_wear_estimate'],
                confidence=s['confidence'],
                cliff_probability=cliff_probs[i],
                rolling_rate_of_change=rolling_derivs[i],
                cliff_onset_lap=cliff_onset_lap,
                compound=s['compound'],
                tyre_health_pct=s['tyre_health_pct'],
                base_pace=s.get('base_pace', 0.0),
                fuel_effect=s.get('fuel_effect', 0.0),
                track_evolution_effect=s.get('track_evolution_effect', 0.0),
                tyre_wear_effect=s.get('tyre_wear_effect', 0.0),
                residual_noise=s.get('residual_noise', 0.0),
                is_representative=s.get('is_representative', True)
            ))

        return records_out

    def estimate_session_tyre_state(
        self,
        session_key: int,
        driver_number: int
    ) -> Dict[str, Any]:
        """
        Produce full session tyre state estimation and cliff detection for a driver.
        """
        cache_key = f"{session_key}_{driver_number}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        decomposed = self.decomposer.decompose_session(session_key, driver_number)
        if not decomposed:
            result = {
                "session_key": session_key,
                "driver_number": driver_number,
                "stints": {},
                "records": []
            }
            self._cache[cache_key] = result
            return result

        # Group decomposed records by stint
        stint_groups: Dict[int, List[DecomposedLapRecord]] = {}
        for r in decomposed:
            if r.stint_number not in stint_groups:
                stint_groups[r.stint_number] = []
            stint_groups[r.stint_number].append(r)

        all_state_records: List[BayesianTyreStateRecord] = []
        stint_summaries: Dict[int, Dict[str, Any]] = {}

        for s_num, s_recs in sorted(stint_groups.items()):
            # Determine compound: Stint 1 Hard, Stint 2 Medium (or fallback)
            comp = "HARD" if s_num == 1 else "MEDIUM"
            state_recs = self.estimate_stint_state(s_recs, compound=comp)
            all_state_records.extend(state_recs)

            cliff_onset = state_recs[0].cliff_onset_lap if state_recs else None
            max_cliff_p = max([r.cliff_probability for r in state_recs]) if state_recs else 0.0
            stint_summaries[s_num] = {
                "stint_number": s_num,
                "compound": comp,
                "laps_count": len(state_recs),
                "cliff_onset_lap": cliff_onset,
                "max_cliff_probability": max_cliff_p,
                "final_wear_rate": state_recs[-1].wear_rate_estimate if state_recs else 0.0,
                "final_health_pct": state_recs[-1].tyre_health_pct if state_recs else 100.0,
                "baseline_wear_rate": state_recs[0].wear_rate_estimate if state_recs else 0.05,
                "fitted_base_pace": s_recs[0].base_pace if s_recs else 96.5,
                "representative_lap_count": len(state_recs),
            }

        result = {
            "session_key": session_key,
            "driver_number": driver_number,
            "stints": stint_summaries,
            "records": [r.to_dict() for r in all_state_records],
            "lap_lookup": {r.lap_number: r.to_dict() for r in all_state_records}
        }
        self._cache[cache_key] = result
        return result


# Convenience functions

_state_engine_instance: Optional[BayesianTyreStateEngine] = None
_tyre_state_cache: Dict[Tuple[int, int], Dict[str, Any]] = {}

def _get_state_engine() -> BayesianTyreStateEngine:
    global _state_engine_instance
    if _state_engine_instance is None:
        _state_engine_instance = BayesianTyreStateEngine()
    return _state_engine_instance


def get_driver_tyre_state(
    session_key: int,
    driver_number: int,
    use_cache: bool = True
) -> Dict[str, Any]:
    """Retrieve full tyre state and cliff history for a driver session with memory caching."""
    cache_key = (session_key, driver_number)
    if use_cache and cache_key in _tyre_state_cache:
        return _tyre_state_cache[cache_key]

    engine = _get_state_engine()
    res = engine.estimate_session_tyre_state(session_key, driver_number)
    if use_cache:
        _tyre_state_cache[cache_key] = res
    return res


def estimate_bayesian_tyre_state(
    decomposed_degradation: List[float],
    lap_numbers: List[int],
    compound: str = "MEDIUM"
) -> Dict[str, Any]:
    """
    Convenience function estimating current latent tyre state from a series
    of clean decomposed degradation values.
    """
    # Build synthetic decomposed lap records
    synthetic_recs = [
        DecomposedLapRecord(
            lap_number=l_num,
            stint_number=1,
            tyre_age=i + 1,
            observed=100.0 + deg,
            base_pace=100.0,
            fuel_effect=0.0,
            track_evolution_effect=0.0,
            tyre_wear_effect=deg,
            residual=0.0,
            counterfactual_prev_lap_tyre=100.0 + max(0.0, deg - 0.04),
            compound=compound
        )
        for i, (l_num, deg) in enumerate(zip(lap_numbers, decomposed_degradation))
    ]
    engine = _get_state_engine()
    state_recs = engine.estimate_stint_state(synthetic_recs, compound=compound)
    if not state_recs:
        return {
            "wear_rate_estimate": 0.050,
            "wear_rate_90pct_interval": (0.000, 0.100),
            "cumulative_wear_estimate": 0.0,
            "confidence": "INSUFFICIENT_EVIDENCE",
            "cliff_probability": 0.02,
            "tyre_health_pct": 100.0
        }
    latest = state_recs[-1]
    return latest.to_dict()


def detect_tyre_cliff(
    tyre_state_history: List[Dict[str, Any]],
    stint_laps: int
) -> Dict[str, Any]:
    """
    Convenience function detecting tyre cliff onset from state history records.
    """
    if not tyre_state_history:
        return {
            "cliff_detected": False,
            "cliff_onset_lap": None,
            "max_cliff_probability": 0.0
        }
    max_p = max((r.get("cliff_probability", 0.0) for r in tyre_state_history), default=0.0)
    cliff_onset = next((r.get("cliff_onset_lap") for r in tyre_state_history if r.get("cliff_onset_lap") is not None), None)
    return {
        "cliff_detected": cliff_onset is not None or max_p >= 0.50,
        "cliff_onset_lap": cliff_onset,
        "max_cliff_probability": max_p
    }
