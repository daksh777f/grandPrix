"""
Tyre Degradation Intelligence (TDI) - Causal Pace Decomposition Engine.

Roadmap Context:
- Phase 2 of the 12-phase TDI architecture.
- Decomposes raw lap times into constituent causal components for every REPRESENTATIVE lap:
    observed_lap_time = base_pace + fuel_effect + track_evolution_effect
                         + tyre_wear_effect + residual_noise

Causal Term Definitions:
1. base_pace: The driver's theoretical zero-fuel, zero-wear, fully-evolved-track lap time
   at this circuit. Estimated as the zero-wear intercept of the fuel-and-evolution corrected
   pace regression (not merely the raw fastest lap time, ensuring zero double-counting).
2. fuel_effect: Analytical fuel mass penalty (seconds) decreasing monotonically as fuel burns:
   fuel_effect(lap_number) = (total_fuel_at_start - burn_rate * lap_number) * seconds_per_kg
3. track_evolution_effect: Empirical session-wide track grip evolution fitted across all
   drivers' representative laps. Negative effect (pace improvement) that asymptotically flattens.
4. tyre_wear_effect: Isolated tyre degradation signal per stint, reset to ~0 at the start
   of each stint (tyre_age=1). This clean signal serves as primary input to Phase 3 (Bayesian State).
5. residual_noise: Lap-to-lap deviation remaining after removing the four causal terms,
   centered at zero with zero systematic trend across the session.

Subsequent Phases:
- Phase 3: Bayesian Latent Tyre State & Cliff Detection (tyre_state.py)
- Phase 4: Counterfactual Engine & Post-Race Validator (tyre_validation.py)
- Phase 5: Strategy Simulator / Monte Carlo Pit Window (tyre_strategy.py)
- Phase 6-12: API, UI & Voice Integration
"""

import os
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit

try:
    from data.tyre_constants import (
        SINGAPORE_STARTING_FUEL_KG,
        FUEL_BURN_RATE_KG_PER_LAP,
        FUEL_EFFECT_SEC_PER_KG,
    )
    from services.tyre_quality import LapQualityFlagger, LapQualityRecord, filter_representative_laps
except ImportError:
    from backend.data.tyre_constants import (
        SINGAPORE_STARTING_FUEL_KG,
        FUEL_BURN_RATE_KG_PER_LAP,
        FUEL_EFFECT_SEC_PER_KG,
    )
    from backend.services.tyre_quality import LapQualityFlagger, LapQualityRecord, filter_representative_laps


@dataclass
class DecomposedLapRecord:
    """Typed per-lap causal decomposition record."""
    lap_number: int
    stint_number: int
    tyre_age: int
    observed: float
    base_pace: float
    fuel_effect: float
    track_evolution_effect: float
    tyre_wear_effect: float
    residual: float
    counterfactual_prev_lap_tyre: float
    compound: str = "UNKNOWN"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def compute_fuel_effect(
    lap_number: int,
    starting_fuel_kg: float = SINGAPORE_STARTING_FUEL_KG,
    burn_rate_kg: float = FUEL_BURN_RATE_KG_PER_LAP,
    fuel_effect_sec_per_kg: float = FUEL_EFFECT_SEC_PER_KG
) -> float:
    """
    Calculate the analytical fuel penalty (in seconds) for a given lap number.
    Always positive early in the race (heavy fuel load = slower lap time),
    shrinking monotonically to near zero at race completion.
    """
    remaining_fuel = max(0.0, starting_fuel_kg - burn_rate_kg * lap_number)
    return remaining_fuel * fuel_effect_sec_per_kg


# Backward compatibility alias
compute_fuel_correction = compute_fuel_effect


def compute_track_evolution(
    lap_number: int,
    e_max: float = 0.4858,
    decay_rate: float = 0.1171
) -> float:
    """
    Calculate the session-wide empirical track evolution grip effect (in seconds).
    Pace improves (negative seconds penalty) as laps progress and asymptotically flattens.
    """
    if lap_number <= 1:
        return 0.0
    return - float(e_max * (1.0 - np.exp(- decay_rate * (lap_number - 1))))


class CausalTyreDecomposer:
    """
    Engine for fitting session-wide track evolution and decomposing driver stints
    into base pace, fuel mass penalty, track grip evolution, and tyre wear.
    """

    def __init__(self, base_dir: Optional[str] = None):
        self.flagger = LapQualityFlagger(base_dir=base_dir)
        self._session_track_evo_params: Dict[int, Tuple[float, float]] = {}

    def fit_session_track_evolution(self, session_key: int) -> Tuple[float, float]:
        """
        Fit a shared empirical track evolution curve E(lap) = - E_max * (1 - exp(- decay_rate * (lap - 1)))
        across ALL drivers' representative laps in the session after removing each driver's fuel effect.
        """
        if session_key in self._session_track_evo_params:
            return self._session_track_evo_params[session_key]

        self.flagger._load_data()
        if self.flagger._laps_df is None:
            # Default fallback parameters calibrated for Marina Bay
            params = (0.4858, 0.1171)
            self._session_track_evo_params[session_key] = params
            return params

        drivers = sorted(
            self.flagger._laps_df[
                self.flagger._laps_df['session_key'] == session_key
            ]['driver_number'].unique()
        )

        all_fuel_corrected = []
        for d in drivers:
            recs = self.flagger.flag_session(session_key, int(d))
            rep_recs = [r for r in recs if 'REPRESENTATIVE' in r.flags and r.lap_duration is not None]
            if len(rep_recs) < 3:
                continue

            # Driver baseline pace on early laps
            early_paces = [
                r.lap_duration - compute_fuel_effect(r.lap_number)
                for r in rep_recs[:3]
                if r.lap_duration is not None
            ]
            if not early_paces:
                continue
            driver_base = float(np.median(early_paces))

            for r in rep_recs:
                fe = compute_fuel_effect(r.lap_number)
                corr_dur = (r.lap_duration - fe) - driver_base  # type: ignore[operator]
                all_fuel_corrected.append({
                    'driver_number': int(d),
                    'lap_number': r.lap_number,
                    'stint_number': r.stint_number,
                    'tyre_age': r.tyre_age,
                    'delta_dur': corr_dur
                })

        if not all_fuel_corrected:
            params = (0.4858, 0.1171)
            self._session_track_evo_params[session_key] = params
            return params

        df_all = pd.DataFrame(all_fuel_corrected)
        early_laps = df_all[df_all['lap_number'] <= 15].groupby('lap_number')['delta_dur'].agg(['median', 'count']).reset_index()
        valid_early = early_laps[early_laps['count'] >= 5]

        if len(valid_early) >= 4:
            try:
                def exp_decay_model(lap, e_max, decay):
                    return - e_max * (1.0 - np.exp(- decay * (lap - 1)))

                popt, _ = curve_fit(
                    exp_decay_model,
                    valid_early['lap_number'],
                    valid_early['median'],
                    p0=[0.40, 0.12],
                    bounds=([0.10, 0.01], [0.80, 0.40])
                )
                params = (float(popt[0]), float(popt[1]))
            except Exception:
                params = (0.4858, 0.1171)
        else:
            params = (0.4858, 0.1171)

        self._session_track_evo_params[session_key] = params
        return params

    def decompose_session(
        self,
        session_key: int,
        driver_number: int
    ) -> List[DecomposedLapRecord]:
        """
        Perform causal pace decomposition for all REPRESENTATIVE laps of a driver session.
        Solves for:
        - session track evolution curve E(lap)
        - per-stint zero-wear base pace (intercept of fuel-and-evolution corrected pace vs tyre_age)
        - clean isolated tyre wear effect (reset to 0 at stint start)
        - zero-centered residual noise
        - counterfactual lap pace on one-lap-fresher tyres
        """
        e_max, decay_rate = self.fit_session_track_evolution(session_key)

        records = self.flagger.flag_session(session_key, driver_number)
        rep_recs = [r for r in records if 'REPRESENTATIVE' in r.flags and r.lap_duration is not None]

        if not rep_recs:
            return []

        # Group by stint number to fit per-stint baseline pace and wear slope
        stint_groups: Dict[int, List[LapQualityRecord]] = {}
        for r in rep_recs:
            if r.stint_number not in stint_groups:
                stint_groups[r.stint_number] = []
            stint_groups[r.stint_number].append(r)

        stint_models: Dict[int, Dict[str, float]] = {}
        for s_num, s_recs in stint_groups.items():
            ages = np.array([r.tyre_age for r in s_recs])
            # Fuel and evolution corrected lap duration:
            # adj_pace = observed - fuel_effect - track_evolution_effect
            adj_paces = np.array([
                r.lap_duration - compute_fuel_effect(r.lap_number) - compute_track_evolution(r.lap_number, e_max, decay_rate)
                for r in s_recs
                if r.lap_duration is not None
            ])

            # Regression: adj_pace = base_pace + slope * (tyre_age - 1)
            # base_pace represents the theoretical zero-wear lap time at the start of this stint
            if len(s_recs) >= 2:
                x = ages - 1.0
                A = np.vstack([np.ones(len(x)), x]).T
                res = np.linalg.lstsq(A, adj_paces, rcond=None)[0]
                base_pace, slope = float(res[0]), float(res[1])
                # Ensure non-negative wear slope physically
                if slope < 0:
                    slope = 0.0
                    base_pace = float(np.median(adj_paces))
            else:
                base_pace = float(adj_paces[0]) if len(adj_paces) > 0 else 100.0
                slope = 0.040

            stint_models[s_num] = {
                'base_pace': base_pace,
                'slope': slope
            }

        decomposed: List[DecomposedLapRecord] = []
        for r in rep_recs:
            s_num = r.stint_number
            model = stint_models[s_num]
            base = model['base_pace']
            slope = model['slope']

            fe = compute_fuel_effect(r.lap_number)
            te = compute_track_evolution(r.lap_number, e_max, decay_rate)
            dur = float(r.lap_duration)  # type: ignore[arg-type]

            # Tyre wear effect at current tyre age (reset to 0 at tyre_age=1)
            wear = float(slope * (r.tyre_age - 1.0))

            # Residual noise captures small zero-centered lap-to-lap fluctuations
            residual = float(dur - (base + fe + te + wear))

            # Counterfactual: What would this lap have been on 1-lap-fresher tyres?
            hypo_age = max(1, r.tyre_age - 1)
            hypo_wear = float(slope * (hypo_age - 1.0))
            cf_prev = float(base + fe + te + hypo_wear + residual)

            decomposed.append(DecomposedLapRecord(
                lap_number=r.lap_number,
                stint_number=r.stint_number,
                tyre_age=r.tyre_age,
                observed=dur,
                base_pace=base,
                fuel_effect=fe,
                track_evolution_effect=te,
                tyre_wear_effect=wear,
                residual=residual,
                counterfactual_prev_lap_tyre=cf_prev,
                compound=r.compound
            ))

        return decomposed


_decomposer_instance: Optional[CausalTyreDecomposer] = None

def _get_decomposer() -> CausalTyreDecomposer:
    global _decomposer_instance
    if _decomposer_instance is None:
        _decomposer_instance = CausalTyreDecomposer()
    return _decomposer_instance


def decompose_driver_session(
    session_key: int,
    driver_number: int
) -> List[Dict[str, Any]]:
    """
    Decompose all representative laps for a driver session and return a list of dictionaries.
    """
    decomposer = _get_decomposer()
    records = decomposer.decompose_session(session_key, driver_number)
    return [r.to_dict() for r in records]


def decompose_stint_pace(
    session_key: int,
    driver_number: int,
    stint_number: int
) -> Dict[str, Any]:
    """
    Decompose representative laps for a specific stint and return summary parameters.
    """
    decomposer = _get_decomposer()
    records = decomposer.decompose_session(session_key, driver_number)
    stint_recs = [r for r in records if r.stint_number == stint_number]

    if not stint_recs:
        return {
            "session_key": session_key,
            "driver_number": driver_number,
            "stint_number": stint_number,
            "laps_count": 0,
            "base_pace": 0.0,
            "records": []
        }

    return {
        "session_key": session_key,
        "driver_number": driver_number,
        "stint_number": stint_number,
        "laps_count": len(stint_recs),
        "base_pace": stint_recs[0].base_pace,
        "mean_residual": float(np.mean([r.residual for r in stint_recs])),
        "std_residual": float(np.std([r.residual for r in stint_recs])),
        "records": [r.to_dict() for r in stint_recs]
    }


def counterfactual_lap(
    session_key: int,
    driver_number: int,
    lap_number: int,
    hypothetical_tyre_age: int
) -> float:
    """
    Calculate what a specific lap's time WOULD have been if tyre_age were different,
    holding fuel load, track evolution, and driving performance/noise constant.
    """
    decomposer = _get_decomposer()
    records = decomposer.decompose_session(session_key, driver_number)

    # Locate matching lap
    target_rec = next((r for r in records if r.lap_number == lap_number), None)
    if target_rec is None:
        # Fallback if lap was not in representative set: compute directly
        e_max, decay_rate = decomposer.fit_session_track_evolution(session_key)
        fe = compute_fuel_effect(lap_number)
        te = compute_track_evolution(lap_number, e_max, decay_rate)
        # Approximate base pace and slope
        base_pace = 97.0
        slope = 0.040
        hypo_wear = slope * max(0, hypothetical_tyre_age - 1)
        return float(base_pace + fe + te + hypo_wear)

    # From target record's stint model
    # Delta in tyre wear from current tyre age to hypothetical tyre age
    actual_age = target_rec.tyre_age
    slope = target_rec.tyre_wear_effect / (actual_age - 1.0) if actual_age > 1 else 0.040
    hypo_wear = float(slope * max(0, hypothetical_tyre_age - 1))

    # Reconstruct counterfactual lap time:
    # counterfactual = base_pace + fuel_effect + track_evolution_effect + hypothetical_wear + residual
    return float(
        target_rec.base_pace
        + target_rec.fuel_effect
        + target_rec.track_evolution_effect
        + hypo_wear
        + target_rec.residual
    )
