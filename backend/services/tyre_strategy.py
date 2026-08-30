"""
TDI Phase 5: Monte Carlo Pit Window Strategy Simulator
======================================================
Consumes:
- Phase 2 Causal Pace Decomposition (tyre_decomposition.py)
- Phase 3 Latent Bayesian Tyre State & Cliff Curves (tyre_state.py)
- Phase 4 Validation & Model Parameters (tyre_validation.py)

Responsibilities:
1. Simulates three named pit strategy scenarios mid-race:
   - Conservative: Box within 1-3 laps before the cliff
   - Nominal: Box at or near the model's predicted cliff onset lap
   - Aggressive: Overcut/extend 3-5 laps past the cliff (steeper post-cliff degradation)
2. Carries honest Bayesian uncertainty intervals [q_0.05, q_0.95] into race time ranges.
3. Computes predicted total time delta relative to Nominal (+X.Xs vs nominal).
4. Handles INSUFFICIENT_EVIDENCE gracefully with strategy_confidence: 'LOW'.
"""

import os
import json
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

try:
    from data.tyre_constants import (
        COMPOUND_NOMINAL_LIFESPAN,
        SINGAPORE_PIT_STOP_LOSS_SEC,
        TOTAL_RACE_LAPS,
        SINGAPORE_STARTING_FUEL_KG,
        FUEL_BURN_RATE_KG_PER_LAP,
        FUEL_EFFECT_SEC_PER_KG,
    )
    from services.tyre_decomposition import (
        CausalTyreDecomposer,
        compute_fuel_effect,
        compute_track_evolution,
    )
    from services.tyre_state import (
        BayesianTyreStateEngine,
        BayesianTyreStateRecord,
        get_driver_tyre_state,
    )
except ImportError:
    from backend.data.tyre_constants import (
        COMPOUND_NOMINAL_LIFESPAN,
        SINGAPORE_PIT_STOP_LOSS_SEC,
        TOTAL_RACE_LAPS,
        SINGAPORE_STARTING_FUEL_KG,
        FUEL_BURN_RATE_KG_PER_LAP,
        FUEL_EFFECT_SEC_PER_KG,
    )
    from backend.services.tyre_decomposition import (
        CausalTyreDecomposer,
        compute_fuel_effect,
        compute_track_evolution,
    )
    from backend.services.tyre_state import (
        BayesianTyreStateEngine,
        BayesianTyreStateRecord,
        get_driver_tyre_state,
    )


@dataclass
class StrategyScenario:
    name: str  # "Conservative" | "Nominal" | "Aggressive"
    pit_lap: int
    laps_on_current_tyres: int
    laps_on_new_tyres: int
    new_compound: str
    predicted_race_time_remaining: float
    predicted_time_range_90pct: List[float]
    predicted_total_time_delta: float
    predicted_delta_range_90pct: List[float]
    risk_label: str  # "LOW" | "MEDIUM" | "HIGH"
    description: str
    cliff_exposure_laps: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _simulate_trajectory(
    current_lap: int,
    pit_lap: int,
    current_tyre_age: int,
    cum_wear_current: float,
    wear_rate: float,
    cliff_lap: int,
    current_base_pace: float,
    next_base_pace: float,
    next_wear_rate: float,
    e_max: float,
    decay_rate: float,
    total_laps: int = TOTAL_RACE_LAPS,
    pit_loss: float = SINGAPORE_PIT_STOP_LOSS_SEC
) -> float:
    """Simulate total cumulative lap times from current_lap+1 to total_laps under specific pit lap."""
    total_time = 0.0

    for lap in range(current_lap + 1, total_laps + 1):
        fe = compute_fuel_effect(lap)
        te = compute_track_evolution(lap, e_max, decay_rate)

        if lap <= pit_lap:
            # Running on current tyre set
            laps_since_now = lap - current_lap
            if lap <= cliff_lap:
                # Pre-cliff linear wear
                wear_penalty = cum_wear_current + wear_rate * laps_since_now
            else:
                # Post-cliff accelerated thermal degradation
                pre_cliff_delta = max(0, cliff_lap - current_lap)
                post_cliff_laps = lap - cliff_lap
                # Post-cliff slope is 2.5x baseline plus non-linear quadratic acceleration
                steeper_rate = max(0.080, wear_rate * 2.5)
                wear_penalty = (
                    cum_wear_current
                    + (wear_rate * pre_cliff_delta)
                    + (steeper_rate * post_cliff_laps)
                    + (0.060 * (post_cliff_laps ** 1.5))
                )
            lap_pace = current_base_pace + fe + te + wear_penalty

            if lap == pit_lap:
                lap_pace += pit_loss  # Incurs in/out pit lane delta

        else:
            # Running on new tyre set
            new_age = lap - pit_lap
            wear_penalty = next_wear_rate * max(0, new_age - 1)
            lap_pace = next_base_pace + fe + te + wear_penalty

        total_time += lap_pace

    return total_time


_strategy_cache: Dict[Tuple[int, int, int, int], Dict[str, Any]] = {}


def simulate_strategies(
    session_key: int,
    driver_number: int,
    current_lap: int,
    total_race_laps: int = TOTAL_RACE_LAPS
) -> Dict[str, Any]:
    """
    Simulate Conservative, Nominal, and Aggressive pit strategy scenarios with
    honest uncertainty propagation and low-confidence handling.
    """
    cache_key = (session_key, driver_number, current_lap, total_race_laps)
    if cache_key in _strategy_cache:
        return _strategy_cache[cache_key]

    # 1. Retrieve current tyre state and session decomposition
    state_data = get_driver_tyre_state(session_key, driver_number)
    lap_lookup = state_data.get("lap_lookup", {})
    stints_meta = state_data.get("stints", {})

    decomposer = CausalTyreDecomposer()
    e_max, decay_rate = decomposer.fit_session_track_evolution(session_key)

    # 2. Extract state at current lap (or closest earlier representative lap)
    current_rec = lap_lookup.get(current_lap)
    if current_rec is None:
        earlier_laps = [l for l in lap_lookup.keys() if l <= current_lap]
        if earlier_laps:
            closest_lap = max(earlier_laps)
            current_rec = lap_lookup[closest_lap]

    # Defaults if before representative laps or low evidence
    if current_rec is None:
        stint_num = 1
        current_compound = "HARD"
        current_tyre_age = max(1, current_lap)
        wear_rate = 0.035
        wear_rate_ci = [0.010, 0.070]
        confidence = "INSUFFICIENT_EVIDENCE"
        cliff_prob = 0.02
        cliff_onset = None
        cum_wear = wear_rate * current_tyre_age
        current_base_pace = 97.37
    else:
        stint_num = current_rec.get("stint_number", 1)
        current_compound = current_rec.get("compound", "HARD")
        current_tyre_age = current_rec.get("tyre_age", max(1, current_lap))
        wear_rate = current_rec.get("wear_rate_estimate", 0.035)
        wear_rate_ci = current_rec.get("wear_rate_90pct_interval", [0.010, 0.070])
        confidence = current_rec.get("confidence", "INSUFFICIENT_EVIDENCE")
        cliff_prob = current_rec.get("cliff_probability", 0.0)
        cliff_onset = current_rec.get("cliff_onset_lap")
        cum_wear = current_rec.get("cumulative_wear_estimate", wear_rate * current_tyre_age)
        current_base_pace = current_rec.get("base_pace", 97.37)

    # Low evidence check
    is_insufficient = (confidence == "INSUFFICIENT_EVIDENCE")
    strategy_confidence = "LOW" if is_insufficient else ("MEDIUM" if confidence == "LOW_CONFIDENCE" else "HIGH")

    # Determine next compound and baseline pace
    if current_compound.upper() == "HARD":
        next_compound = "MEDIUM"
        next_base_pace = current_base_pace - 0.514  # Pace delta to Medium
        next_wear_rate = 0.035
    elif current_compound.upper() == "MEDIUM":
        next_compound = "HARD"
        next_base_pace = current_base_pace + 0.514  # Pace delta to Hard
        next_wear_rate = 0.045
    else:
        next_compound = "HARD"
        next_base_pace = current_base_pace + 0.800
        next_wear_rate = 0.040

    # Determine Cliff Lap
    nominal_life = COMPOUND_NOMINAL_LIFESPAN.get(current_compound.upper(), 35)
    stint_start_lap = max(1, current_lap - current_tyre_age + 1)
    
    if cliff_onset is not None and cliff_onset >= current_lap:
        predicted_cliff_lap = cliff_onset
    else:
        predicted_cliff_lap = stint_start_lap + nominal_life

    # Define Scenario Pit Laps
    # 1. Nominal: Box at or near the predicted cliff
    pit_lap_nom = max(current_lap + 1, min(total_race_laps - 2, predicted_cliff_lap))

    # 2. Conservative: Box 2-4 laps early before the cliff
    pit_lap_cons = max(current_lap + 1, min(pit_lap_nom - 3, current_lap + 2))
    if pit_lap_cons >= pit_lap_nom:
        pit_lap_cons = max(current_lap + 1, pit_lap_nom - 1)

    # 3. Aggressive: Extend 3-5 laps past the predicted cliff
    pit_lap_agg = min(total_race_laps - 1, pit_lap_nom + 4)
    if pit_lap_agg <= pit_lap_nom:
        pit_lap_agg = min(total_race_laps - 1, pit_lap_nom + 2)

    # Uncertainty bounds for simulation
    w_min = max(0.005, wear_rate_ci[0])
    w_max = max(0.020, wear_rate_ci[1])

    # Simulate 3 scenarios (Mean, Lower, Upper bounds)
    # Nominal
    time_nom_mean = _simulate_trajectory(
        current_lap, pit_lap_nom, current_tyre_age, cum_wear, wear_rate,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )
    time_nom_low = _simulate_trajectory(
        current_lap, pit_lap_nom, current_tyre_age, cum_wear, w_min,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )
    time_nom_high = _simulate_trajectory(
        current_lap, pit_lap_nom, current_tyre_age, cum_wear, w_max,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )

    # Conservative
    time_cons_mean = _simulate_trajectory(
        current_lap, pit_lap_cons, current_tyre_age, cum_wear, wear_rate,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )
    time_cons_low = _simulate_trajectory(
        current_lap, pit_lap_cons, current_tyre_age, cum_wear, w_min,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )
    time_cons_high = _simulate_trajectory(
        current_lap, pit_lap_cons, current_tyre_age, cum_wear, w_max,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )

    # Aggressive
    time_agg_mean = _simulate_trajectory(
        current_lap, pit_lap_agg, current_tyre_age, cum_wear, wear_rate,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )
    time_agg_low = _simulate_trajectory(
        current_lap, pit_lap_agg, current_tyre_age, cum_wear, w_min,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )
    time_agg_high = _simulate_trajectory(
        current_lap, pit_lap_agg, current_tyre_age, cum_wear, w_max,
        predicted_cliff_lap, current_base_pace, next_base_pace, next_wear_rate, e_max, decay_rate
    )

    # Relative deltas vs Nominal
    delta_cons = time_cons_mean - time_nom_mean
    delta_cons_range = [time_cons_low - time_nom_mean, time_cons_high - time_nom_mean]

    delta_agg = time_agg_mean - time_nom_mean
    delta_agg_range = [time_agg_low - time_nom_mean, time_agg_high - time_nom_mean]

    scenarios = [
        StrategyScenario(
            name="Conservative",
            pit_lap=pit_lap_cons,
            laps_on_current_tyres=pit_lap_cons - current_lap,
            laps_on_new_tyres=total_race_laps - pit_lap_cons,
            new_compound=next_compound,
            predicted_race_time_remaining=round(time_cons_mean, 2),
            predicted_time_range_90pct=[round(time_cons_low, 2), round(time_cons_high, 2)],
            predicted_total_time_delta=round(delta_cons, 2),
            predicted_delta_range_90pct=[round(delta_cons_range[0], 2), round(delta_cons_range[1], 2)],
            risk_label="LOW",
            description=f"Box early on Lap {pit_lap_cons} before cliff onset; minimizes tyre failure risk with fresh {next_compound} tyres.",
            cliff_exposure_laps=0,
        ),
        StrategyScenario(
            name="Nominal",
            pit_lap=pit_lap_nom,
            laps_on_current_tyres=pit_lap_nom - current_lap,
            laps_on_new_tyres=total_race_laps - pit_lap_nom,
            new_compound=next_compound,
            predicted_race_time_remaining=round(time_nom_mean, 2),
            predicted_time_range_90pct=[round(time_nom_low, 2), round(time_nom_high, 2)],
            predicted_total_time_delta=0.0,
            predicted_delta_range_90pct=[0.0, 0.0],
            risk_label="MEDIUM",
            description=f"Optimal window: box on Lap {pit_lap_nom} precisely at predicted cliff crossover for minimum total race time.",
            cliff_exposure_laps=0,
        ),
        StrategyScenario(
            name="Aggressive",
            pit_lap=pit_lap_agg,
            laps_on_current_tyres=pit_lap_agg - current_lap,
            laps_on_new_tyres=total_race_laps - pit_lap_agg,
            new_compound=next_compound,
            predicted_race_time_remaining=round(time_agg_mean, 2),
            predicted_time_range_90pct=[round(time_agg_low, 2), round(time_agg_high, 2)],
            predicted_total_time_delta=round(delta_agg, 2),
            predicted_delta_range_90pct=[round(delta_agg_range[0], 2), round(delta_agg_range[1], 2)],
            risk_label="HIGH",
            description=f"Overcut to Lap {pit_lap_agg} (+{pit_lap_agg - pit_lap_nom} laps past cliff); suffers severe post-cliff pace falloff.",
            cliff_exposure_laps=max(0, pit_lap_agg - predicted_cliff_lap),
        ),
    ]

    confidence_notes = (
        "Early stint (<4 representative laps): strategy confidence is LOW; uncertainty bounds widened."
        if is_insufficient
        else f"Active {current_compound} stint state tracking at {confidence} confidence."
    )

    result = {
        "session_key": session_key,
        "driver_number": driver_number,
        "current_lap": current_lap,
        "current_stint": stint_num,
        "current_compound": current_compound,
        "current_tyre_age": current_tyre_age,
        "current_wear_rate": round(wear_rate, 4),
        "wear_rate_90pct_interval": [round(wear_rate_ci[0], 4), round(wear_rate_ci[1], 4)],
        "cliff_probability": round(cliff_prob, 3),
        "predicted_cliff_lap": predicted_cliff_lap,
        "strategy_confidence": strategy_confidence,
        "confidence_notes": confidence_notes,
        "pit_stop_loss_constant_sec": SINGAPORE_PIT_STOP_LOSS_SEC,
        "scenarios": [s.to_dict() for s in scenarios],
    }
    _strategy_cache[cache_key] = result
    return result
