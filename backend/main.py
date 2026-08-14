from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.drivers import get_drivers_data
from services.replay import get_replay_data
from services.live_analysis import get_live_analysis
from services.race_engineer import generate_race_engineer_advice
from services.radio import get_radio_intelligence
from pydantic import BaseModel
from typing import Dict, Any

class RaceEngineerRequest(BaseModel):
    corner_metrics: Dict[str, Any]


app = FastAPI(title="Silent Co-Driver API")

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
    return get_live_analysis(session_key, driver_number)

@app.get("/api/radio/{session_key}/{driver_number}")
def get_radio_route(session_key: int, driver_number: int):
    return get_radio_intelligence(session_key, driver_number)

@app.get("/api/corner-history/{session_key}/{driver_number}/{corner}")
def get_corner_history_route(session_key: int, driver_number: int, corner: str):
    from services.corner_history import get_corner_history
    return get_corner_history(session_key, driver_number, corner)

@app.post("/api/race-engineer")
def get_race_engineer_advice_route(request: RaceEngineerRequest):
    return generate_race_engineer_advice(request.corner_metrics)
