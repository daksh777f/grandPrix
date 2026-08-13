# Backend Service

This directory contains the FastAPI application and supporting data services for the Grand Prix racing intelligence platform.

The backend reads local telemetry, timing, radio, and derived analysis files from the repository `data/` directory and exposes them through JSON API endpoints consumed by the frontend.

## Responsibilities

- Load driver, lap, telemetry, and radio data from disk.
- Build replay responses for the frontend race replay experience.
- Generate live analysis snapshots for a given session and driver.
- Extract radio intelligence and race-engineer guidance from the local data sets.
- Keep the service layer deterministic by using file-based inputs and lightweight caching.

## Files

- `main.py` defines the FastAPI application and route handlers.
- `services/drivers.py` returns grid and driver metadata.
- `services/live_analysis.py` computes live telemetry analysis and replay-style samples.
- `services/race_context.py` derives race-state context from timing data.
- `services/race_engineer.py` turns corner metrics into engineer-style recommendations.
- `services/radio.py` processes team radio metadata and related audio assets.
- `services/replay.py` assembles replay payloads for the frontend.
- `data/` contains helper assets used by backend logic.

## Requirements

The pinned package list is intentionally small, but the service code references the following libraries:

- `fastapi`
- `uvicorn`
- `pandas`
- `numpy`
- `requests`
- `whisper`

Install any additional packages required by your runtime if they are not already available in your environment.

## Running locally

From this directory:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## API routes

The service exposes the following routes:

- `GET /api/grid`
- `GET /api/replay/{session_key}/{driver_number}`
- `GET /api/live-analysis/{session_key}/{driver_number}`
- `GET /api/radio/{session_key}/{driver_number}`
- `POST /api/race-engineer`

## Data expectations

The backend expects the repository-level `data/` directory to contain the race assets referenced by the service modules. Those assets include:

- `laps.csv`
- `car_data_*.csv`
- `location_*.csv`
- `team_radio.csv`
- `radio_audio/`
- derived cache files such as `analysis.json` and `telemetry.csv`

If you move or rename those files, update the service paths accordingly.

## Notes

- The backend does not require a database.
- Cache files are stored on disk beside the source data.
- The service is designed for local development and offline reproducibility.
