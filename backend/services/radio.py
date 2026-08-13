import os
import json
import pandas as pd
import requests
from datetime import datetime
import numpy as np

from services.live_analysis import load_driver_data, load_laps
from data.singapore_2023_track import CORNERS
from services.race_engineer import generate_race_engineer_advice
from services.race_context import get_race_context

import whisper

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RADIO_CSV = os.path.join(BASE_DIR, "data", "team_radio.csv")
AUDIO_DIR = os.path.join(BASE_DIR, "data", "radio_audio")
CACHE_FILE = os.path.join(BASE_DIR, "data", "radio_cache.json")

# Ensure audio directory exists
os.makedirs(AUDIO_DIR, exist_ok=True)

# Load cache
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r") as f:
            _radio_cache = json.load(f)
    except Exception:
        _radio_cache = {}
else:
    _radio_cache = {}

def save_cache():
    with open(CACHE_FILE, "w") as f:
        json.dump(_radio_cache, f, indent=2)

# Global whisper model to avoid reloading
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        print("Loading Whisper model (base)...")
        _whisper_model = whisper.load_model("base")
    return _whisper_model

def get_radio_intelligence(session_key: int, driver_number: int):
    # Load radio CSV
    if not os.path.exists(RADIO_CSV):
        return {"messages": []}

    df = pd.read_csv(RADIO_CSV)
    df['session_key'] = pd.to_numeric(df['session_key'], errors='coerce')
    df['driver_number'] = pd.to_numeric(df['driver_number'], errors='coerce')
    df = df[(df['session_key'] == session_key) & (df['driver_number'] == driver_number)]
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.sort_values('date').dropna(subset=['date'])

    # Load telemetry and laps to align
    telemetry_df = load_driver_data(driver_number)
    laps_df = load_laps()
    target_laps = laps_df[(laps_df['session_key'] == session_key) & (laps_df['driver_number'] == driver_number)].copy()

    messages = []

    for idx, row in df.iterrows():
        timestamp_str = str(row['date'])
        recording_url = row.get('recording_url', '')

        if not recording_url or pd.isna(recording_url):
            continue

        file_name = recording_url.split('/')[-1]
        local_audio_path = os.path.join(AUDIO_DIR, file_name)
        cache_key = f"{session_key}_{driver_number}_{file_name}"

        cached_data = _radio_cache.get(cache_key, {})

        # 1. Audio Download
        if not os.path.exists(local_audio_path):
            try:
                print(f"Downloading {file_name}...")
                response = requests.get(recording_url, timeout=10)
                if response.status_code == 200:
                    with open(local_audio_path, 'wb') as f:
                        f.write(response.content)
                    cached_data['local_cached'] = True
                else:
                    cached_data['local_cached'] = False
            except Exception:
                cached_data['local_cached'] = False
        else:
            cached_data['local_cached'] = True

        # 2. Whisper Transcription
        if cached_data.get('local_cached', False) and 'transcript' not in cached_data:
            try:
                model = get_whisper_model()
                print(f"Transcribing {file_name}...")
                result = model.transcribe(local_audio_path, fp16=False)
                transcript_text = result["text"].strip()
                cached_data['transcript'] = transcript_text
                cached_data['transcription_status'] = "READY"
            except Exception as e:
                print(f"Transcription failed: {e}")
                cached_data['transcript'] = None
                cached_data['transcription_status'] = "FAILED"

        # 3. Telemetry Alignment (find closest telemetry point)
        track_context = {}
        telemetry_context = {}
        race_context = {}

        if telemetry_df is not None and not telemetry_df.empty:
            # Find the closest row in telemetry_df
            target_time = row['date']
            # Compute time diff
            time_diffs = (telemetry_df['date'] - target_time).abs()
            nearest_idx = time_diffs.idxmin()

            if pd.notna(nearest_idx) and time_diffs[nearest_idx].total_seconds() < 5.0: # within 5 seconds
                telemetry_row = telemetry_df.loc[nearest_idx]

                # Determine lap
                # Find lap where target_time is between date_start and date_start + lap_duration
                # Since date_start is naive or UTC, we ensure timezone alignment. Both are datetime64[ns, UTC]
                current_lap_df = target_laps[(target_laps['date_start'] <= target_time)]
                current_lap = current_lap_df.iloc[-1]['lap_number'] if not current_lap_df.empty else None
                track_context['lap'] = int(current_lap) if current_lap else None

                # Determine progress and corner
                progress = None
                closest_corner = None
                if current_lap:
                    lap_data = telemetry_df[(telemetry_df['date'] >= current_lap_df.iloc[-1]['date_start'])]
                    if not lap_data.empty:
                        from services.live_analysis import calculate_progress
                        lap_data_with_prog = calculate_progress(lap_data.copy())
                        # find nearest row in lap_data_with_prog
                        time_diffs_lap = (lap_data_with_prog['date'] - target_time).abs()
                        near_idx_lap = time_diffs_lap.idxmin()
                        progress = lap_data_with_prog.loc[near_idx_lap]['progress']

                        min_dist = float('inf')
                        for corner in CORNERS:
                            dist = abs(progress - corner['apex'])
                            if dist < min_dist:
                                min_dist = dist
                                closest_corner = corner['name']

                        if min_dist < 0.05: # within 5% of track distance
                            track_context['corner'] = f"AROUND {closest_corner}"

                track_context['progress'] = progress

                speed = telemetry_row.get('speed', 0)
                brake = telemetry_row.get('brake', 0)
                throttle = telemetry_row.get('throttle', 0)

                telemetry_context['speed'] = int(speed) if pd.notna(speed) else 0

                if brake > 0:
                    track_context['phase'] = "BRAKING"
                elif throttle > 90:
                    track_context['phase'] = "FULL THROTTLE"
                else:
                    track_context['phase'] = "COASTING"

                # Get basic race context
                if current_lap:
                    # target_time is the date of the telemetry row
                    r_ctx_list = get_race_context(session_key, [target_time], driver_number)
                    if r_ctx_list and len(r_ctx_list) > 0 and r_ctx_list[0] is not None:
                        r_ctx = r_ctx_list[0]
                        race_context = {
                            "position": r_ctx.get("position"),
                            "battle_active": r_ctx.get("battle_active", False),
                            "is_defending": r_ctx.get("is_defending", False),
                            "gap_ahead": r_ctx.get("gap_ahead"),
                            "gap_behind": r_ctx.get("gap_behind")
                        }

        # 4. LLM Interpretation
        if cached_data.get('transcript') and 'ai_interpretation' not in cached_data:
            # We construct a metrics dict similar to what race_engineer expects
            c_name = track_context.get('corner', 'UNKNOWN')
            metrics = {
                c_name: {
                    "driver": driver_number,
                    "lap": track_context.get('lap', 'UNKNOWN'),
                    "diagnosis": track_context.get('phase', 'UNKNOWN'),
                    "speed_delta": 0,
                    "time_delta": 0,
                    "is_defending": race_context.get("is_defending", False),
                    "is_attacking": False,
                    "battle_gap": race_context.get("gap_behind", 0) if race_context.get("is_defending") else race_context.get("gap_ahead", 0),
                    "position": race_context.get("position", "UNKNOWN"),
                    "radio_transcript": cached_data.get('transcript')
                }
            }
            try:
                ai_resp_full = generate_race_engineer_advice(metrics)
                ai_resp = ai_resp_full.get(c_name, {})
                cached_data['ai_interpretation'] = {
                    "message": ai_resp.get("observation", ai_resp.get("message", "No clear observation.")),
                    "advice": ai_resp.get("instruction", ai_resp.get("advice", "Maintain current strategy.")),
                    "status": "READY"
                }
            except Exception as e:
                print(f"LLM generation failed: {e}")

        # Update cache
        _radio_cache[cache_key] = cached_data

        # Build message payload
        msg = {
            "timestamp": timestamp_str,
            "driver_number": driver_number,
            "audio": {
                "recording_url": recording_url,
                "local_cached": cached_data.get('local_cached', False)
            },
            "transcription": {
                "status": cached_data.get('transcription_status', 'PENDING'),
                "transcript": cached_data.get('transcript')
            },
            "track_context": track_context,
            "telemetry_context": telemetry_context,
            "race_context": race_context,
            "ai_interpretation": cached_data.get('ai_interpretation'),
            "voice_state": {"state": "ANALYSIS PENDING"} # hardcoded as per instructions
        }

        messages.append(msg)

    save_cache()

    return {
        "driver_number": driver_number,
        "messages": messages
    }
