from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.drivers import get_drivers_data
from services.replay import get_replay_data
from services.live_analysis import get_live_analysis
from services.race_engineer import generate_race_engineer_advice
from services.voice import get_voice_intelligence
from services.timeline import get_race_timeline
from services.lap_comparison import get_completed_comparison_laps, get_default_benchmark_driver, get_lap_comparison, get_recent_comparisons
from services.voice_context import enrich_live_analysis
from pydantic import BaseModel
from typing import Dict, Any
from fastapi.staticfiles import StaticFiles
import os

from services.tyre_state import get_driver_tyre_state
from services.tyre_validation import get_driver_validation_summary, select_most_interesting_laps, get_counterfactual_lap_card_data
from services.tyre_strategy import simulate_strategies

class RaceEngineerRequest(BaseModel):
    corner_metrics: Dict[str, Any]


app = FastAPI(title="Silent Co-Driver & Tyre Degradation Intelligence API")

RADIO_AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "radio_audio")
app.mount("/audio", StaticFiles(directory=RADIO_AUDIO_DIR, check_dir=False), name="radio-audio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/grid")
def get_grid():
    return {"drivers": get_drivers_data()}

@app.get("/api/replay/{session_key}/{driver_number}")
def get_replay(session_key: int, driver_number: int, lap: int = 2):
    return get_replay_data(session_key, driver_number, lap)

@app.get("/api/live-analysis/{session_key}/{driver_number}")
def get_live_analysis_route(session_key: int, driver_number: int):
    return enrich_live_analysis(get_live_analysis(session_key, driver_number))

@app.get("/api/voice/{session_key}/{driver_number}")
def get_voice_route(session_key: int, driver_number: int):
    return get_voice_intelligence(session_key, driver_number)


@app.get("/api/race-timeline/{session_key}/{driver_number}")
def get_race_timeline_route(session_key: int, driver_number: int):
    return get_race_timeline(session_key, driver_number)


@app.get("/api/comparison/{session_key}/{target_driver}/default")
def get_default_comparison_route(session_key: int, target_driver: int):
    return {
        "session_key": session_key,
        "target_driver": target_driver,
        "benchmark_driver": get_default_benchmark_driver(session_key, target_driver),
    }


@app.get("/api/comparison/{session_key}/{target_driver}/{benchmark_driver}/lap/{lap_number}")
def get_lap_comparison_route(session_key: int, target_driver: int, benchmark_driver: int, lap_number: int):
    return get_lap_comparison(session_key, target_driver, benchmark_driver, lap_number)


@app.get("/api/comparison/{session_key}/{target_driver}/{benchmark_driver}/recent")
def get_recent_comparisons_route(session_key: int, target_driver: int, benchmark_driver: int, laps: int = 3, through_lap: int | None = None):
    return get_recent_comparisons(session_key, target_driver, benchmark_driver, laps, through_lap)


@app.get("/api/comparison/{session_key}/{target_driver}/{benchmark_driver}/laps")
def get_completed_comparison_laps_route(session_key: int, target_driver: int, benchmark_driver: int, through_lap: int | None = None):
    return get_completed_comparison_laps(session_key, target_driver, benchmark_driver, through_lap)


@app.get("/api/radio/{session_key}/{driver_number}")
def get_radio_route(session_key: int, driver_number: int):
    """Compatibility alias for clients using the previous radio path."""
    return get_voice_intelligence(session_key, driver_number)

@app.get("/api/corner-history/{session_key}/{driver_number}/{corner}")
def get_corner_history_route(session_key: int, driver_number: int, corner: str):
    from services.corner_history import get_corner_history
    return get_corner_history(session_key, driver_number, corner)

@app.post("/api/race-engineer")
def get_race_engineer_advice_route(request: RaceEngineerRequest):
    return generate_race_engineer_advice(request.corner_metrics)


# ============================================================================
# Tyre Degradation Intelligence (TDI) Endpoints
# ============================================================================

@app.get("/api/tyre/{session_key}/{driver_number}")
def get_tyre_intelligence_route(session_key: int, driver_number: int):
    """
    Primary per-lap tyre intelligence feed for the Live Cockpit HUD:
    Quality flags (Phase 1), Causal Decomposition (Phase 2), Latent Bayesian Tyre State & Cliff Probabilities (Phase 3).
    """
    return get_driver_tyre_state(session_key, driver_number)


@app.get("/api/tyre/counterfactual/{session_key}/{driver_number}")
def get_tyre_counterfactual_route(session_key: int, driver_number: int):
    """
    Returns 3-5 auto-selected showcase laps with full causal counterfactual breakdowns and freshness deltas.
    """
    interesting_cards = select_most_interesting_laps(session_key, driver_number)
    all_cards = get_counterfactual_lap_card_data(session_key, driver_number)
    return {
        "session_key": session_key,
        "driver_number": driver_number,
        "showcase_count": len(interesting_cards),
        "interesting_laps": interesting_cards,
        "all_representative_laps": [c.to_dict() if hasattr(c, "to_dict") else c for c in all_cards],
    }


@app.get("/api/tyre/validation/{session_key}/{driver_number}")
def get_tyre_validation_route(session_key: int, driver_number: int):
    """
    Returns the full post-race validation scorecard from Phase 4,
    honestly labeling the within-session mid-stint holdout validation methodology.
    """
    summary = get_driver_validation_summary(session_key, driver_number)
    scorecard = summary.get("validation_scorecard", {})
    return {
        "session_key": session_key,
        "driver_number": driver_number,
        "validation_mode": scorecard.get("validation_mode", "MID_STINT_HOLDOUT"),
        "description": scorecard.get("description", "Within-session holdout validation: trained on first half of stint, validated on second half."),
        "overall_accuracy_score": scorecard.get("overall_accuracy_score", 0.0),
        "stints": scorecard.get("stints", []),
        "interesting_laps": summary.get("interesting_laps", []),
        "total_representative_laps": summary.get("total_representative_laps", 0),
    }


@app.get("/api/tyre/strategy/{session_key}/{driver_number}")
def get_tyre_strategy_route(session_key: int, driver_number: int, lap: int = 38, current_lap: int | None = None):
    """
    Returns the three-scenario pit strategy simulation (Conservative, Nominal, Aggressive)
    with honest uncertainty intervals and risk ratings for a given point in the race.
    """
    effective_lap = current_lap if current_lap is not None else lap
    return simulate_strategies(session_key, driver_number, effective_lap)

