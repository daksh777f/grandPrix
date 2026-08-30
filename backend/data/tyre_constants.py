"""
Tyre Degradation Intelligence (TDI) - Physical & Operational Constants.

These constants provide the baseline parameters for:
- Phase 1: Lap Quality Flagging Engine
- Phase 2: Causal Pace Decomposition Engine
- Phase 3: Bayesian Latent Tyre State & Cliff Detection
- Phase 4: Counterfactual Engine & Post-Race Validator
- Phase 5: Monte Carlo Pit Window Strategy Simulator
"""

# Fuel model parameters (Singapore GP specific approximations)
SINGAPORE_STARTING_FUEL_KG: float = 110.0  # Estimated initial fuel mass in kg
FUEL_BURN_RATE_KG_PER_LAP: float = 1.75    # Average fuel consumption in kg per lap
FUEL_EFFECT_SEC_PER_KG: float = 0.033      # Pace penalty in seconds per kg of fuel

# Track evolution parameters
TRACK_EVOLUTION_DECAY_SEC_PER_LAP: float = 0.015  # Lap time improvement due to track grip evolution

# Traffic & Battle detection (reusing constant from race_context.py)
TRAFFIC_GAP_THRESHOLD_SEC: float = 0.25  # Gap threshold to trigger traffic / dirty air penalty

# Confidence and uncertainty thresholds
CONFIDENCE_FLOOR: float = 0.20           # Minimum Bayesian posterior confidence
CONFIDENCE_CEILING: float = 0.95         # Maximum confidence limit
UNCERTAINTY_SIGMA_FLOOR: float = 0.005    # Minimum standard deviation numerical safety floor (sec)

# Compound nominal lifespan approximations (in laps, Singapore Marina Bay)
COMPOUND_NOMINAL_LIFESPAN: dict[str, int] = {
    "SOFT": 18,
    "MEDIUM": 28,
    "HARD": 40,
}

# Singapore Marina Bay Pit Lane & Strategy Constants
SINGAPORE_PIT_STOP_LOSS_SEC: float = 23.5  # Standard pit stop stationary + in/out lane delta (seconds)
TOTAL_RACE_LAPS: int = 62                 # Total official laps for Singapore 2023 Grand Prix

