"""Cache-only voice context lookup for the live simulation path.

This module intentionally does not import ``services.voice`` or any inference
library. It reads completed transcript/voice-analysis JSON artifacts only.
"""

import bisect
import csv
import json
import os
from datetime import datetime
from typing import Any

from services.voice_identity import cache_stem, event_id


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RADIO_CSV = os.path.join(BASE_DIR, "data", "team_radio.csv")
LAPS_CSV = os.path.join(BASE_DIR, "data", "laps.csv")
TRANSCRIPT_DIR = os.path.join(BASE_DIR, "data", "radio_transcripts")
VOICE_ANALYSIS_DIR = os.path.join(BASE_DIR, "data", "voice_analysis")
LIVE_WINDOW_SECONDS = float(os.getenv("RADIO_CONTEXT_WINDOW_SECONDS", "30"))
OLLAMA_WINDOW_SECONDS = float(os.getenv("RADIO_OLLAMA_CONTEXT_WINDOW_SECONDS", "15"))
TELEMETRY_TOLERANCE_SECONDS = 5.0

_events_cache: dict[tuple[int, int], list[dict[str, Any]]] = {}


def _read_json(path: str) -> dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            value = json.load(handle)
        return value if isinstance(value, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _session_start(session_key: int, driver_number: int) -> datetime | None:
    try:
        with open(LAPS_CSV, "r", encoding="utf-8", newline="") as handle:
            rows = csv.DictReader(handle)
            starts = [
                _parse_timestamp(row.get("date_start"))
                for row in rows
                if row.get("session_key") == str(session_key)
                and row.get("driver_number") == str(driver_number)
            ]
        valid = [start for start in starts if start is not None]
        return min(valid) if valid else None
    except OSError:
        return None


def _load_live_samples(session_key: int, driver_number: int) -> list[dict[str, Any]]:
    cache_path = os.path.join(BASE_DIR, "data", f"cache_{session_key}_{driver_number}.json")
    cached = _read_json(cache_path) or {}
    samples = cached.get("samples", [])
    return sorted(samples, key=lambda sample: float(sample.get("elapsed", 0)))


def _nearest_sample(samples: list[dict[str, Any]], elapsed: float) -> tuple[dict[str, Any] | None, float]:
    if not samples:
        return None, float("inf")
    elapsed_values = [float(sample.get("elapsed", 0)) for sample in samples]
    index = bisect.bisect_left(elapsed_values, elapsed)
    candidates = []
    if index < len(samples):
        candidates.append((samples[index], abs(elapsed_values[index] - elapsed)))
    if index > 0:
        candidates.append((samples[index - 1], abs(elapsed_values[index - 1] - elapsed)))
    return min(candidates, key=lambda candidate: candidate[1])


def _load_cached_events(session_key: int, driver_number: int) -> list[dict[str, Any]]:
    cache_key = (session_key, driver_number)
    if cache_key in _events_cache:
        return _events_cache[cache_key]

    start = _session_start(session_key, driver_number)
    samples = _load_live_samples(session_key, driver_number)
    events: list[dict[str, Any]] = []
    try:
        with open(RADIO_CSV, "r", encoding="utf-8", newline="") as handle:
            radio_rows = csv.DictReader(handle)
            rows = [
                row for row in radio_rows
                if row.get("session_key") == str(session_key)
                and row.get("driver_number") == str(driver_number)
            ]
    except OSError:
        rows = []

    for row in rows:
        timestamp_text = row.get("date", "")
        timestamp = _parse_timestamp(timestamp_text)
        if timestamp is None or start is None:
            continue
        elapsed = (timestamp - start).total_seconds()
        sample, distance = _nearest_sample(samples, elapsed)
        if sample is None or distance > TELEMETRY_TOLERANCE_SECONDS:
            continue

        recording_url = row.get("recording_url", "")
        stem = cache_stem(session_key, driver_number, recording_url)
        transcript_data = _read_json(os.path.join(TRANSCRIPT_DIR, f"{stem}.json")) or {}
        voice_data = _read_json(os.path.join(VOICE_ANALYSIS_DIR, f"{stem}.json")) or {}
        interpretation = _read_json(os.path.join(VOICE_ANALYSIS_DIR, f"{stem}_interpretation.json"))
        transcript = transcript_data.get("transcript") if transcript_data.get("status") == "READY" else None
        voice_state = voice_data.get("voice_state") if voice_data.get("status") == "READY" else None
        if transcript is None and voice_state is None:
            continue

        corner = sample.get("current_corner", {}).get("name")
        progress = sample.get("progress")
        events.append({
            "available": True,
            "event_id": event_id(session_key, driver_number, timestamp.isoformat(), sample.get("lap_number"), corner, progress),
            "timestamp": timestamp.isoformat(),
            "elapsed": round(elapsed, 3),
            "lap": sample.get("lap_number"),
            "corner": corner,
            "phase": sample.get("current_corner", {}).get("phase"),
            "progress": progress,
            "transcript": transcript,
            "voice_state": voice_state,
            "vocal_arousal": voice_data.get("vocal_arousal") if voice_data.get("status") == "READY" else None,
            "emotion": voice_data.get("emotion") if voice_data.get("status") == "READY" else None,
            "interpretation": interpretation if interpretation and interpretation.get("status") in {"READY", "FALLBACK"} else None,
        })

    events.sort(key=lambda event: event["elapsed"])
    _events_cache[cache_key] = events
    return events


def _candidate_sort_key(event: dict[str, Any], elapsed: float, lap: int | None, corner: str | None, progress: float | None) -> tuple[int, int, float, float]:
    same_corner = int(bool(corner and corner != "Straight" and event.get("corner") == corner))
    same_lap = int(lap is not None and event.get("lap") == lap)
    progress_distance = abs(float(event.get("progress", 0)) - progress) if progress is not None and event.get("progress") is not None else 1.0
    elapsed_distance = abs(float(event["elapsed"]) - elapsed)
    return (-same_corner, -same_lap, progress_distance, elapsed_distance)


def get_nearby_voice_context(session_key: int, driver_number: int, elapsed: float, lap: int | None, corner: str | None, progress: float | None) -> dict[str, Any] | None:
    events = _load_cached_events(session_key, driver_number)
    candidates = [event for event in events if abs(float(event["elapsed"]) - elapsed) <= LIVE_WINDOW_SECONDS]
    if not candidates:
        return None
    return min(candidates, key=lambda event: _candidate_sort_key(event, elapsed, lap, corner, progress))


def _relevant_for_ollama(context: dict[str, Any], elapsed: float, lap: int | None, corner: str | None, progress: float | None) -> bool:
    if abs(float(context["elapsed"]) - elapsed) > OLLAMA_WINDOW_SECONDS:
        return False
    same_corner = bool(corner and corner != "Straight" and context.get("corner") == corner)
    same_lap_nearby = (
        lap is not None
        and context.get("lap") == lap
        and progress is not None
        and context.get("progress") is not None
        and abs(float(context["progress"]) - progress) <= 0.12
    )
    return same_corner or same_lap_nearby


def enrich_live_analysis(result: dict[str, Any]) -> dict[str, Any]:
    """Attach cached voice context without performing any inference or Ollama calls."""
    session_key = int(result["session_key"])
    driver_number = int(result["target_driver"])
    for sample in result.get("samples", []):
        context = get_nearby_voice_context(
            session_key,
            driver_number,
            float(sample.get("elapsed", 0)),
            sample.get("lap_number"),
            sample.get("current_corner", {}).get("name"),
            sample.get("progress"),
        )
        sample["voice_context"] = context
        if (
            context
            and sample.get("communication", {}).get("state") == "RADIO_NOW"
            and _relevant_for_ollama(context, float(sample.get("elapsed", 0)), sample.get("lap_number"), sample.get("current_corner", {}).get("name"), sample.get("progress"))
            and context.get("interpretation")
        ):
            sample["analysis"]["message"] = context["interpretation"].get("message", sample["analysis"].get("message"))
            sample["analysis"]["advice"] = context["interpretation"].get("advice", sample["analysis"].get("advice"))
    return result
