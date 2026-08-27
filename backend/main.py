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

class RaceEngineerRequest(BaseModel):
    corner_metrics: Dict[str, Any]


app = FastAPI(title="Silent Co-Driver API")

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
