"""Cached Hugging Face voice intelligence for team radio events.

Hugging Face extracts speech and vocal-state signals. Ollama is only used
afterward to phrase a race-engineer interpretation from structured evidence.
"""

import json
import os
import re
import threading
import torch
from typing import Any
from urllib.parse import urlparse

import numpy as np
import pandas as pd
import requests

from data.singapore_2023_track import CORNERS
from services.live_analysis import calculate_progress, load_driver_data, load_laps
from services.race_context import get_race_context
from services.race_engineer import generate_voice_interpretation
from services.voice_identity import cache_stem, event_id


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RADIO_CSV = os.path.join(BASE_DIR, "data", "team_radio.csv")
AUDIO_DIR = os.path.join(BASE_DIR, "data", "radio_audio")
TRANSCRIPT_DIR = os.path.join(BASE_DIR, "data", "radio_transcripts")
VOICE_ANALYSIS_DIR = os.path.join(BASE_DIR, "data", "voice_analysis")

ASR_MODEL_ID = "openai/whisper-large-v3"
EMOTION_MODEL_ID = "superb/wav2vec2-base-superb-er"
SAMPLE_RATE = 16_000
TELEMETRY_TOLERANCE_SECONDS = 5.0

_asr_pipeline = None
_emotion_pipeline = None
_model_lock = threading.Lock()
_cache_lock = threading.Lock()


def _ensure_cache_dirs() -> None:
    for directory in (AUDIO_DIR, TRANSCRIPT_DIR, VOICE_ANALYSIS_DIR):
        os.makedirs(directory, exist_ok=True)


def _read_json(path: str) -> dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            value = json.load(handle)
        return value if isinstance(value, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _usable_inference_cache(cached: dict[str, Any] | None) -> dict[str, Any] | None:
    """Reuse successful results, but allow dependency failures to recover."""
    if cached is None:
        return None
    if cached.get("status") == "READY":
        return cached
    error = str(cached.get("error", ""))
    if "No module named" not in error and "cannot import" not in error.lower():
        return cached
    return None


def _write_json(path: str, value: dict[str, Any]) -> None:
    temporary_path = f"{path}.tmp"
    with _cache_lock:
        with open(temporary_path, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2)
        os.replace(temporary_path, path)


def _download_audio(recording_url: str, audio_path: str) -> tuple[bool, str | None]:
    if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
        return True, None

    try:
        response = requests.get(recording_url, timeout=20, stream=True)
        response.raise_for_status()
        temporary_path = f"{audio_path}.part"
        with open(temporary_path, "wb") as handle:
            for chunk in response.iter_content(chunk_size=64 * 1024):
                if chunk:
                    handle.write(chunk)
        os.replace(temporary_path, audio_path)
        return True, None
    except Exception as exc:
        try:
            if os.path.exists(f"{audio_path}.part"):
                os.remove(f"{audio_path}.part")
        except OSError:
            pass
        return False, str(exc)


def _load_audio(audio_path: str) -> tuple[np.ndarray, int, float]:
    """Decode MP3 to mono float32 samples at the model's required rate."""
    import librosa

    waveform, sample_rate = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)
    waveform = np.asarray(waveform, dtype=np.float32)
    if waveform.size == 0:
        raise ValueError("Audio file contains no samples")
    return waveform, SAMPLE_RATE, float(waveform.size / SAMPLE_RATE)


def _get_pipeline(kind: str):
    global _asr_pipeline, _emotion_pipeline

    with _model_lock:
        if kind == "asr" and _asr_pipeline is None:
            from transformers import pipeline

            token = os.getenv("HF_TOKEN") or None
            _asr_pipeline = pipeline(
                "automatic-speech-recognition",
                model=ASR_MODEL_ID,
                token=token,
                chunk_length_s=30,
                device=0 if torch.cuda.is_available() else -1,
                generate_kwargs={"language": "en"},
            )
        elif kind == "emotion" and _emotion_pipeline is None:
            from transformers import pipeline

            token = os.getenv("HF_TOKEN") or None
            _emotion_pipeline = pipeline(
                "audio-classification",
                model=EMOTION_MODEL_ID,
                token=token,
                top_k=None,
                device=0 if torch.cuda.is_available() else -1,
            )

    return _asr_pipeline if kind == "asr" else _emotion_pipeline


def _transcribe(audio_path: str, cache_path: str) -> dict[str, Any]:
    cached = _usable_inference_cache(_read_json(cache_path))
    if cached is not None:
        return cached

    result: dict[str, Any] = {
        "status": "UNAVAILABLE",
        "transcript": None,
        "model": ASR_MODEL_ID,
        "provider": "Hugging Face",
    }
    try:
        waveform, sample_rate, duration = _load_audio(audio_path)
        output = _get_pipeline("asr")({"raw": waveform, "sampling_rate": sample_rate})
        transcript = str(output.get("text", "")).strip()
        result.update({
            "status": "READY" if transcript else "FAILED",
            "transcript": transcript or None,
            "duration_seconds": round(duration, 3),
        })
    except Exception as exc:
        result.update({"status": "FAILED", "error": str(exc)})

    _write_json(cache_path, result)
    return result


def _derive_voice_state(scores: dict[str, float]) -> tuple[str, float | None]:
    if not scores:
        return "UNAVAILABLE", None

    neutral_score = scores.get("neu", scores.get("neutral", 0.0))
    vocal_arousal = max(0.0, min(1.0, 1.0 - neutral_score))
    if vocal_arousal >= 0.65:
        state = "HIGH_INTENSITY"
    elif vocal_arousal >= 0.35:
        state = "ELEVATED"
    else:
        state = "CALM"
    return state, round(vocal_arousal, 3)


def _classify_emotion(audio_path: str, cache_path: str) -> dict[str, Any]:
    cached = _usable_inference_cache(_read_json(cache_path))
    if cached is not None:
        return cached

    result: dict[str, Any] = {
        "status": "UNAVAILABLE",
        "emotion": None,
        "scores": {},
        "voice_state": "UNAVAILABLE",
        "vocal_arousal": None,
        "model": EMOTION_MODEL_ID,
        "provider": "Hugging Face",
    }
    try:
        waveform, sample_rate, duration = _load_audio(audio_path)
        output = _get_pipeline("emotion")({"raw": waveform, "sampling_rate": sample_rate})
        predictions = output[0] if output and isinstance(output[0], list) else output
        scores = {
            str(item["label"]): round(float(item["score"]), 5)
            for item in predictions
            if "label" in item and "score" in item
        }
        if not scores:
            raise ValueError("Emotion model returned no labels")
        emotion = max(scores, key=scores.get)
        voice_state, vocal_arousal = _derive_voice_state(scores)
        result.update({
            "status": "READY",
            "emotion": emotion,
            "scores": scores,
            "voice_state": voice_state,
            "vocal_arousal": vocal_arousal,
            "duration_seconds": round(duration, 3),
        })
    except Exception as exc:
        result.update({"status": "FAILED", "error": str(exc)})

    _write_json(cache_path, result)
    return result


def _find_lap_context(laps: pd.DataFrame, session_key: int, driver_number: int, timestamp: pd.Timestamp) -> tuple[pd.Series | None, pd.Timestamp | None]:
    target_laps = laps[
        (laps["session_key"] == session_key)
        & (laps["driver_number"] == driver_number)
        & laps["date_start"].notna()
    ].sort_values("date_start")
    candidates = target_laps[target_laps["date_start"] <= timestamp]
    if candidates.empty:
        return None, None

    lap = candidates.iloc[-1]
    next_laps = target_laps[target_laps["lap_number"] > lap["lap_number"]]
    if not next_laps.empty:
        end_time = next_laps.iloc[0]["date_start"]
    else:
        duration = lap.get("lap_duration")
        seconds = float(duration) if pd.notna(duration) else 120.0
        end_time = lap["date_start"] + pd.Timedelta(seconds=seconds)
    return lap, end_time


def _nearest_live_sample(session_key: int, driver_number: int, timestamp: pd.Timestamp, session_start: pd.Timestamp | None) -> dict[str, Any] | None:
    cache_path = os.path.join(BASE_DIR, "data", f"cache_{session_key}_{driver_number}.json")
    cached = _read_json(cache_path)
    if not cached or not cached.get("samples") or session_start is None:
        return None

    target_elapsed = (timestamp - session_start).total_seconds()
    closest = min(cached["samples"], key=lambda sample: abs(float(sample.get("elapsed", 0)) - target_elapsed))
    if abs(float(closest.get("elapsed", 0)) - target_elapsed) > TELEMETRY_TOLERANCE_SECONDS:
        return None
    return closest


def _fallback_context(timestamp: pd.Timestamp, session_key: int, driver_number: int, telemetry: pd.DataFrame | None, laps: pd.DataFrame) -> dict[str, Any]:
    context: dict[str, Any] = {
        "lap": None,
        "corner": None,
        "phase": None,
        "progress": None,
        "performance": {
            "speed": None,
            "entry_speed_delta": None,
            "diagnosis": None,
            "estimated_time_delta": None,
            "confidence": None,
        },
        "race_context": {},
        "communication": None,
    }
    if telemetry is None or telemetry.empty:
        return context

    time_diffs = (telemetry["date"] - timestamp).abs()
    nearest_index = time_diffs.idxmin()
    if time_diffs[nearest_index].total_seconds() > TELEMETRY_TOLERANCE_SECONDS:
        return context

    row = telemetry.loc[nearest_index]
    lap, lap_end = _find_lap_context(laps, session_key, driver_number, timestamp)
    if lap is None:
        return context

    context["lap"] = int(lap["lap_number"])
    context["performance"]["speed"] = int(row["speed"]) if pd.notna(row.get("speed")) else None

    lap_data = telemetry[(telemetry["date"] >= lap["date_start"]) & (telemetry["date"] < lap_end)].copy()
    if not lap_data.empty:
        lap_data = calculate_progress(lap_data)
        nearest_lap_index = (lap_data["date"] - timestamp).abs().idxmin()
        progress = float(lap_data.loc[nearest_lap_index]["progress"])
        context["progress"] = progress
        closest_corner = min(CORNERS, key=lambda corner: abs(progress - corner["apex"]))
        if closest_corner["start"] <= progress <= closest_corner["end"]:
            context["corner"] = closest_corner["name"]
            if progress < closest_corner["braking_start"]:
                context["phase"] = "APPROACH"
            elif progress < closest_corner["apex"]:
                context["phase"] = "BRAKING"
            elif progress < closest_corner["exit"]:
                context["phase"] = "CORNER"
            else:
                context["phase"] = "EXIT"

    race_context = get_race_context(session_key, driver_number, pd.Series([timestamp]))
    if race_context:
        context["race_context"] = race_context[0] or {}
    return context


def _build_context(session_key: int, driver_number: int, timestamp: pd.Timestamp, telemetry: pd.DataFrame | None, laps: pd.DataFrame, session_start: pd.Timestamp | None) -> dict[str, Any]:
    fallback = _fallback_context(timestamp, session_key, driver_number, telemetry, laps)
    live_sample = _nearest_live_sample(session_key, driver_number, timestamp, session_start)
    if live_sample is None:
        return fallback

    corner = live_sample.get("current_corner", {})
    analysis = live_sample.get("analysis", {})
    comparison = live_sample.get("comparison", {})
    return {
        "lap": live_sample.get("lap_number", fallback["lap"]),
        "corner": corner.get("name") or fallback["corner"],
        "phase": corner.get("phase") or fallback["phase"],
        "progress": live_sample.get("progress", fallback["progress"]),
        "performance": {
            "speed": live_sample.get("target", {}).get("speed", fallback["performance"]["speed"]),
            "entry_speed_delta": comparison.get("entry_speed_delta"),
            "diagnosis": analysis.get("diagnosis"),
            "estimated_time_delta": analysis.get("estimated_time_delta"),
            "confidence": analysis.get("confidence"),
        },
        "race_context": live_sample.get("race_context") or fallback["race_context"],
        "communication": live_sample.get("communication"),
    }


def _fallback_interpretation(transcript: str | None, voice: dict[str, Any], context: dict[str, Any]) -> dict[str, str]:
    diagnosis = context["performance"].get("diagnosis") or "NO_DIAGNOSIS"
    corner = context.get("corner") or "the current section"
    voice_state = voice.get("voice_state")
    emotion = voice.get("emotion")

    if corner == "Straight":
        if transcript:
            observation = "Recent radio provides driver context during a straight; no corner diagnosis is attached."
            advice = "Follow the team's race guidance and manage the current race situation."
        else:
            observation = "No corner diagnosis is attached to this straight section."
            advice = "No driver instruction required."
        if voice_state and voice_state != "UNAVAILABLE":
            observation += f" Voice state is {voice_state.lower().replace('_', ' ')}."
        return {"message": observation, "advice": advice, "status": "FALLBACK"}

    if diagnosis == "EARLY_BRAKING":
        advice = f"Release the brake progressively and carry more speed into {corner}."
        observation = f"The radio transmission aligns with an entry deficit at {corner}."
    elif diagnosis == "LOW_ENTRY_SPEED":
        advice = f"Carry more speed into {corner} while keeping the car balanced."
        observation = f"The radio transmission aligns with low entry speed at {corner}."
    elif diagnosis == "LOW_MIN_SPEED":
        advice = f"Prioritize rotation and maintain momentum through {corner}."
        observation = f"The radio transmission aligns with minimum-speed loss at {corner}."
    elif diagnosis == "LATE_THROTTLE":
        advice = f"Start the throttle phase earlier on the exit of {corner}."
        observation = f"The radio transmission aligns with a late-throttle pattern at {corner}."
    elif diagnosis == "LOW_EXIT_SPEED":
        advice = f"Prioritize a clean exit and earlier acceleration from {corner}."
        observation = f"The radio transmission aligns with exit-speed loss at {corner}."
    else:
        advice = "Maintain the current approach and keep monitoring the next sector."
        observation = "The transmission is available with synchronized race context, but no deterministic deficit is attached."

    if voice_state and voice_state != "UNAVAILABLE":
        observation += f" Voice state is {voice_state.lower().replace('_', ' ')}."
    elif emotion:
        observation += f" The classifier label is {emotion}."
    return {"message": observation, "advice": advice, "status": "FALLBACK"}


def _interpret(transcript: str | None, voice: dict[str, Any], context: dict[str, Any], cache_path: str) -> dict[str, str] | None:
    cached = _read_json(cache_path)
    if cached is not None and cached.get("status") in {"READY", "FALLBACK"}:
        if context.get("corner") == "Straight" and "Straight telemetry" in str(cached.get("message", "")):
            cached = None
        else:
            return cached

    if not transcript:
        return None

    payload = {
        "transcript": transcript,
        "voice": {
            "emotion": voice.get("emotion"),
            "voice_state": voice.get("voice_state"),
            "vocal_arousal": voice.get("vocal_arousal"),
        },
        "context": context,
    }
    try:
        result = generate_voice_interpretation(payload)
    except Exception:
        result = _fallback_interpretation(transcript, voice, context)
    _write_json(cache_path, result)
    return result


def get_voice_intelligence(session_key: int, driver_number: int) -> dict[str, Any]:
    _ensure_cache_dirs()
    if not os.path.exists(RADIO_CSV):
        return {"session_key": session_key, "driver_number": driver_number, "messages": []}

    radio_df = pd.read_csv(RADIO_CSV)
    radio_df["session_key"] = pd.to_numeric(radio_df["session_key"], errors="coerce")
    radio_df["driver_number"] = pd.to_numeric(radio_df["driver_number"], errors="coerce")
    radio_df = radio_df[
        (radio_df["session_key"] == session_key)
        & (radio_df["driver_number"] == driver_number)
    ].copy()
    radio_df["date"] = pd.to_datetime(radio_df["date"], errors="coerce")
    radio_df = radio_df.sort_values("date").dropna(subset=["date"])

    telemetry = load_driver_data(driver_number)
    laps = load_laps()
    session_laps = laps[(laps["session_key"] == session_key) & (laps["driver_number"] == driver_number)]
    session_start_value = session_laps["date_start"].dropna().min() if not session_laps.empty else pd.NaT
    session_start = session_start_value if pd.notna(session_start_value) else None
    messages = []

    for _, row in radio_df.iterrows():
        recording_url = str(row.get("recording_url", "")).strip()
        if not recording_url or recording_url == "nan":
            continue

        stem = cache_stem(session_key, driver_number, recording_url)
        cached_file_name = f"{stem}.mp3"
        cached_audio_path = os.path.join(AUDIO_DIR, cached_file_name)
        legacy_file_name = re.sub(r"[^A-Za-z0-9_.-]", "_", os.path.basename(urlparse(recording_url).path))
        legacy_audio_path = os.path.join(AUDIO_DIR, legacy_file_name)
        if not os.path.exists(cached_audio_path) and os.path.exists(legacy_audio_path):
            file_name = legacy_file_name
            audio_path = legacy_audio_path
        else:
            file_name = cached_file_name
            audio_path = cached_audio_path
        transcript_path = os.path.join(TRANSCRIPT_DIR, f"{stem}.json")
        voice_path = os.path.join(VOICE_ANALYSIS_DIR, f"{stem}.json")
        audio_available, download_error = _download_audio(recording_url, audio_path)

        transcript_data = {"status": "UNAVAILABLE", "transcript": None, "provider": "Hugging Face", "model": ASR_MODEL_ID}
        emotion_data = {
            "status": "UNAVAILABLE",
            "emotion": None,
            "scores": {},
            "voice_state": "UNAVAILABLE",
            "vocal_arousal": None,
            "provider": "Hugging Face",
            "model": EMOTION_MODEL_ID,
        }
        if audio_available:
            transcript_data = _transcribe(audio_path, transcript_path)
            emotion_data = _classify_emotion(audio_path, voice_path)
        elif download_error:
            transcript_data["error"] = download_error
            emotion_data["error"] = download_error

        timestamp = row["date"]
        context = _build_context(session_key, driver_number, timestamp, telemetry, laps, session_start)
        interpretation_path = os.path.join(VOICE_ANALYSIS_DIR, f"{stem}_interpretation.json")
        interpretation = _interpret(transcript_data.get("transcript"), emotion_data, context, interpretation_path)

        radio_event_id = event_id(
            session_key,
            driver_number,
            timestamp.isoformat(),
            context["lap"],
            context["corner"],
            context["progress"],
        )
        elapsed = None
        if session_start is not None:
            elapsed = round(float((timestamp - session_start).total_seconds()), 3)

        local_audio_url = f"/audio/{file_name}" if audio_available else None
        performance = context["performance"]
        messages.append({
            "event_id": radio_event_id,
            "timestamp": timestamp.isoformat(),
            "elapsed": elapsed,
            "driver_number": driver_number,
            "lap": context["lap"],
            "corner": context["corner"],
            "phase": context["phase"],
            "progress": context["progress"],
            "recording_url": recording_url,
            "audio": {
                "recording_url": recording_url,
                "audio_url": local_audio_url or recording_url,
                "local_cached": audio_available,
            },
            "transcript": transcript_data.get("transcript"),
            "transcription_status": transcript_data.get("status", "UNAVAILABLE"),
            "voice": {
                "emotion": emotion_data.get("emotion"),
                "scores": emotion_data.get("scores", {}),
                "voice_state": emotion_data.get("voice_state", "UNAVAILABLE"),
                "vocal_arousal": emotion_data.get("vocal_arousal"),
                "status": emotion_data.get("status", "UNAVAILABLE"),
                "model": EMOTION_MODEL_ID,
                "provider": "Hugging Face",
            },
            "performance": performance,
            "race_context": context["race_context"],
            "communication": context["communication"],
            "ai_interpretation": interpretation,
        })

    return {
        "session_key": session_key,
        "driver_number": driver_number,
        "models": {
            "asr": {"provider": "Hugging Face", "model": ASR_MODEL_ID},
            "emotion": {"provider": "Hugging Face", "model": EMOTION_MODEL_ID},
        },
        "messages": messages,
    }
