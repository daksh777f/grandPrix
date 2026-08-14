"""Explicit target-vs-benchmark completed-lap coaching."""

import json
import os
from typing import Any

import pandas as pd
from fastapi import HTTPException

from data.singapore_2023_track import CORNERS
from services.live_analysis import calculate_progress, load_driver_data, load_laps
from services.race_engineer import generate_lap_coaching_advice


MIN_CORNER_SAMPLES = 5
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COACHING_CACHE_FILE = os.path.join(BASE_DIR, "data", "lap_coaching_cache.json")

_comparison_cache: dict[tuple[int, int, int, int], dict[str, Any]] = {}
_coaching_cache: dict[str, dict[str, Any]] = {}
if os.path.exists(COACHING_CACHE_FILE):
    try:
        with open(COACHING_CACHE_FILE, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
            if isinstance(loaded, dict):
                _coaching_cache = loaded
    except (OSError, json.JSONDecodeError):
        _coaching_cache = {}


def _validate_drivers(target_driver: int, benchmark_driver: int) -> None:
    if target_driver == benchmark_driver:
        raise HTTPException(status_code=400, detail="Target and benchmark drivers must be different")


def _lap_row(laps: pd.DataFrame, session_key: int, driver_number: int, lap_number: int) -> pd.Series | None:
    rows = laps[
        (laps["session_key"] == session_key)
        & (laps["driver_number"] == driver_number)
        & (laps["lap_number"] == lap_number)
        & laps["date_start"].notna()
    ]
    return rows.iloc[0] if not rows.empty else None


def _lap_window(laps: pd.DataFrame, row: pd.Series, session_key: int, driver_number: int) -> tuple[pd.Timestamp, pd.Timestamp]:
    start = row["date_start"]
    next_rows = laps[
        (laps["session_key"] == session_key)
        & (laps["driver_number"] == driver_number)
        & (laps["lap_number"] > row["lap_number"])
        & laps["date_start"].notna()
    ].sort_values("lap_number")
    if not next_rows.empty:
        return start, next_rows.iloc[0]["date_start"]
    duration = row.get("lap_duration")
    seconds = float(duration) if pd.notna(duration) else 120.0
    return start, start + pd.Timedelta(seconds=seconds)


def _load_lap(laps: pd.DataFrame, driver_number: int, session_key: int, lap_number: int) -> tuple[pd.DataFrame, pd.Series]:
    row = _lap_row(laps, session_key, driver_number, lap_number)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Lap {lap_number} is unavailable for driver {driver_number}")
    driver_data = load_driver_data(driver_number)
    if driver_data is None:
        raise HTTPException(status_code=404, detail=f"Telemetry is unavailable for driver {driver_number}")
    start, end = _lap_window(laps, row, session_key, driver_number)
    lap_data = driver_data[(driver_data["date"] >= start) & (driver_data["date"] < end)].copy()
    if lap_data.empty:
        raise HTTPException(status_code=404, detail=f"Telemetry is unavailable for driver {driver_number} on lap {lap_number}")
    lap_data = calculate_progress(lap_data).sort_values("progress").reset_index(drop=True)
    return lap_data, row


def _first_progress(frame: pd.DataFrame, condition: pd.Series) -> float | None:
    values = frame.loc[condition, "progress"]
    return float(values.min()) if not values.empty else None


def _corner_metrics(frame: pd.DataFrame, corner: dict[str, Any]) -> dict[str, Any] | None:
    section = frame[(frame["progress"] >= corner["start"]) & (frame["progress"] <= corner["end"])].copy()
    if len(section) < MIN_CORNER_SAMPLES:
        return None

    speed = section["speed"].dropna()
    if speed.empty:
        return None
    brake_progress = _first_progress(section, section["brake"].fillna(0) > 0)
    throttle_section = section[section["progress"] >= corner["apex"]]
    throttle_progress = _first_progress(throttle_section, throttle_section["throttle"].fillna(0) > 50)
    return {
        "entry_speed": int(section.iloc[0]["speed"]) if pd.notna(section.iloc[0]["speed"]) else None,
        "braking_progress": brake_progress,
        "minimum_speed": int(speed.min()),
        "exit_speed": int(section.iloc[-1]["speed"]) if pd.notna(section.iloc[-1]["speed"]) else None,
        "throttle_progress": throttle_progress,
        "traversal_time": round(float((section.iloc[-1]["date"] - section.iloc[0]["date"]).total_seconds()), 4),
        "sample_count": int(len(section)),
    }


def _confidence(target: dict[str, Any], benchmark: dict[str, Any]) -> float:
    sample_factor = min(1.0, min(target["sample_count"], benchmark["sample_count"]) / 20)
    time_factor = 0.15 if target["traversal_time"] is not None and benchmark["traversal_time"] is not None else 0
    metric_factor = 0.1 if target["entry_speed"] is not None and benchmark["entry_speed"] is not None else 0
    return round(min(0.99, 0.55 + sample_factor * 0.2 + time_factor + metric_factor), 2)


def _diagnosis(delta: dict[str, float | None]) -> str:
    if delta["braking"] is not None and delta["entry_speed"] is not None and delta["braking"] < -0.005 and delta["entry_speed"] < -5:
        return "EARLY_BRAKING"
    if delta["entry_speed"] is not None and delta["entry_speed"] < -10:
        return "LOW_ENTRY_SPEED"
    if delta["minimum_speed"] is not None and delta["minimum_speed"] < -7:
        return "LOW_MIN_SPEED"
    if delta["throttle_delay"] is not None and delta["throttle_delay"] > 0.005:
        return "LATE_THROTTLE"
    if delta["exit_speed"] is not None and delta["exit_speed"] < -8:
        return "LOW_EXIT_SPEED"
    return "GOOD"


def _compare_corner(target: dict[str, Any], benchmark: dict[str, Any], corner_name: str) -> dict[str, Any]:
    def difference(key: str) -> float | None:
        if target[key] is None or benchmark[key] is None:
            return None
        return round(float(target[key] - benchmark[key]), 4)

    delta = {
        "entry_speed": difference("entry_speed"),
        "minimum_speed": difference("minimum_speed"),
        "exit_speed": difference("exit_speed"),
        "braking": difference("braking_progress"),
        "throttle_delay": difference("throttle_progress"),
        "traversal_time": difference("traversal_time"),
    }
    diagnosis = _diagnosis(delta)
    return {
        "corner": corner_name,
        "target": {key: value for key, value in target.items() if key != "sample_count"},
        "benchmark": {key: value for key, value in benchmark.items() if key != "sample_count"},
        "delta": delta,
        "diagnosis": diagnosis,
        "estimated_time_delta": delta["traversal_time"],
        "confidence": _confidence(target, benchmark),
    }


def _driver_label(driver_number: int) -> str:
    drivers_path = os.path.join(BASE_DIR, "data", "drivers.csv")
    try:
        drivers = pd.read_csv(drivers_path)
        row = drivers[drivers["driver_number"] == driver_number]
        if not row.empty and pd.notna(row.iloc[0].get("name_acronym")):
            return str(row.iloc[0]["name_acronym"])
    except (OSError, KeyError, pd.errors.ParserError):
        pass
    return f"DRIVER {driver_number}"


def _benchmark_strengths(corners: list[dict[str, Any]], benchmark_driver: int) -> list[str]:
    benchmark_label = _driver_label(benchmark_driver)
    strengths: list[tuple[float, str]] = []
    for result in corners:
        delta = result["delta"]
        corner = result["corner"]
        if delta["entry_speed"] is not None and delta["entry_speed"] < -1:
            strengths.append((abs(delta["entry_speed"]), f"{benchmark_label} carries {abs(delta['entry_speed']):g} km/h more entry speed at {corner}."))
        if delta["minimum_speed"] is not None and delta["minimum_speed"] < -1:
            strengths.append((abs(delta["minimum_speed"]), f"{benchmark_label} carries {abs(delta['minimum_speed']):g} km/h more minimum speed at {corner}."))
        if delta["exit_speed"] is not None and delta["exit_speed"] < -1:
            strengths.append((abs(delta["exit_speed"]), f"{benchmark_label} has {abs(delta['exit_speed']):g} km/h more exit speed at {corner}."))
        if delta["throttle_delay"] is not None and delta["throttle_delay"] > 0.005:
            strengths.append((delta["throttle_delay"], f"{benchmark_label} returns to throttle {delta['throttle_delay']:.3f} progress units earlier at {corner}."))
        if delta["braking"] is not None and delta["braking"] < -0.002:
            strengths.append((abs(delta["braking"]), f"{benchmark_label} brakes later at {corner}."))
    strengths.sort(key=lambda item: item[0], reverse=True)
    return [text for _, text in strengths[:4]]


def _fallback_coaching(comparison: dict[str, Any]) -> dict[str, str]:
    top = comparison.get("top_losses", [])
    if not top:
        return {
            "message": "No reliable corner loss was isolated on this lap.",
            "advice": "Keep the current approach and continue building a clean benchmark comparison.",
            "status": "FALLBACK",
        }
    loss = top[0]
    corner = loss["corner"]
    diagnosis = loss["diagnosis"].replace("_", " ")
    strengths = [strength for strength in comparison.get("benchmark_strengths", []) if corner in strength]
    advantage = strengths[0] if strengths else f"The benchmark shows a stronger {diagnosis.lower()} profile at {corner}."
    advice = {
        "EARLY_BRAKING": f"Brake later into {corner} and carry more entry speed next lap.",
        "LOW_ENTRY_SPEED": f"Carry more speed into {corner} next lap.",
        "LOW_MIN_SPEED": f"Protect minimum speed through {corner} next lap.",
        "LATE_THROTTLE": f"Return to throttle earlier at {corner} and prioritize the exit.",
        "LOW_EXIT_SPEED": f"Prioritize a cleaner exit from {corner} next lap.",
    }.get(loss["diagnosis"], f"Focus on {corner} next lap.")
    return {
        "message": f"The largest reliable loss is {corner} at +{loss['time_loss']:.3f}s. {advantage}",
        "advice": advice,
        "status": "FALLBACK",
    }


def _coaching_key(session_key: int, target_driver: int, benchmark_driver: int, lap_number: int) -> str:
    return f"{session_key}:{target_driver}:{benchmark_driver}:{lap_number}"


def _get_coaching(comparison: dict[str, Any]) -> dict[str, str]:
    key = _coaching_key(comparison["session_key"], comparison["target_driver"], comparison["benchmark_driver"], comparison["lap"])
    if key in _coaching_cache:
        return _coaching_cache[key]
    fallback = _fallback_coaching(comparison)
    if comparison.get("top_losses"):
        payload = {
            "target_driver": comparison["target_driver"],
            "benchmark_driver": comparison["benchmark_driver"],
            "lap": comparison["lap"],
            "target_lap_time": comparison["target_lap_time"],
            "benchmark_lap_time": comparison["benchmark_lap_time"],
            "lap_delta": comparison["lap_delta"],
            "top_losses": comparison["top_losses"],
            "benchmark_strengths": comparison["benchmark_strengths"],
        }
        try:
            result = generate_lap_coaching_advice(payload, fallback)
        except Exception:
            result = fallback
    else:
        result = fallback
    _coaching_cache[key] = result
    try:
        os.makedirs(os.path.dirname(COACHING_CACHE_FILE), exist_ok=True)
        with open(COACHING_CACHE_FILE, "w", encoding="utf-8") as handle:
            json.dump(_coaching_cache, handle, indent=2)
    except OSError:
        pass
    return result


def get_lap_comparison(session_key: int, target_driver: int, benchmark_driver: int, lap_number: int) -> dict[str, Any]:
    _validate_drivers(target_driver, benchmark_driver)
    cache_key = (session_key, target_driver, benchmark_driver, lap_number)
    if cache_key in _comparison_cache:
        return _comparison_cache[cache_key]

    laps = load_laps()
    target_data, target_row = _load_lap(laps, target_driver, session_key, lap_number)
    benchmark_data, benchmark_row = _load_lap(laps, benchmark_driver, session_key, lap_number)
    corners: list[dict[str, Any]] = []
    for corner in CORNERS:
        target_metrics = _corner_metrics(target_data, corner)
        benchmark_metrics = _corner_metrics(benchmark_data, corner)
        if target_metrics is not None and benchmark_metrics is not None:
            corners.append(_compare_corner(target_metrics, benchmark_metrics, corner["name"]))

    top_losses = [
        {
            "corner": result["corner"],
            "time_loss": result["estimated_time_delta"],
            "diagnosis": result["diagnosis"],
            "confidence": result["confidence"],
        }
        for result in corners
        if result["estimated_time_delta"] is not None
        and result["estimated_time_delta"] > 0
        and result["confidence"] >= 0.7
    ]
    top_losses.sort(key=lambda item: item["time_loss"], reverse=True)
    result = {
        "session_key": int(session_key),
        "lap": int(lap_number),
        "target_driver": int(target_driver),
        "benchmark_driver": int(benchmark_driver),
        "target_lap_time": float(target_row["lap_duration"]) if pd.notna(target_row.get("lap_duration")) else None,
        "benchmark_lap_time": float(benchmark_row["lap_duration"]) if pd.notna(benchmark_row.get("lap_duration")) else None,
        "lap_delta": round(float(target_row["lap_duration"] - benchmark_row["lap_duration"]), 3) if pd.notna(target_row.get("lap_duration")) and pd.notna(benchmark_row.get("lap_duration")) else None,
        "corners": corners,
        "top_losses": top_losses[:5],
        "benchmark_strengths": _benchmark_strengths(corners, benchmark_driver),
    }
    result["coaching"] = _get_coaching(result)
    _comparison_cache[cache_key] = result
    return result


def get_recent_comparisons(session_key: int, target_driver: int, benchmark_driver: int, laps_count: int = 3, through_lap: int | None = None) -> dict[str, Any]:
    _validate_drivers(target_driver, benchmark_driver)
    laps = load_laps()
    target_laps = laps[
        (laps["session_key"] == session_key)
        & (laps["driver_number"] == target_driver)
        & laps["date_start"].notna()
        & laps["lap_duration"].notna()
    ]
    if through_lap is not None:
        target_laps = target_laps[target_laps["lap_number"] <= through_lap]
    available = []
    for lap_number in sorted(target_laps["lap_number"].astype(int).unique(), reverse=True):
        try:
            available.append(get_lap_comparison(session_key, target_driver, benchmark_driver, lap_number))
        except HTTPException:
            continue
        if len(available) >= max(1, min(laps_count, 10)):
            break
    available.sort(key=lambda comparison: comparison["lap"])
    trend = _recent_trend(available)
    return {
        "session_key": int(session_key),
        "target_driver": int(target_driver),
        "benchmark_driver": int(benchmark_driver),
        "laps": available,
        "trend": trend,
    }


def get_completed_comparison_laps(session_key: int, target_driver: int, benchmark_driver: int, through_lap: int | None = None) -> dict[str, Any]:
    """Return only shared, completed laps that meet comparison data requirements."""
    _validate_drivers(target_driver, benchmark_driver)
    laps = load_laps()
    target_rows = laps[
        (laps["session_key"] == session_key)
        & (laps["driver_number"] == target_driver)
        & laps["date_start"].notna()
        & laps["lap_duration"].notna()
    ]
    benchmark_rows = laps[
        (laps["session_key"] == session_key)
        & (laps["driver_number"] == benchmark_driver)
        & laps["date_start"].notna()
        & laps["lap_duration"].notna()
    ]
    shared_laps = set(target_rows["lap_number"].astype(int)).intersection(set(benchmark_rows["lap_number"].astype(int)))
    if through_lap is not None:
        shared_laps = {lap for lap in shared_laps if lap <= through_lap}

    valid_laps: list[int] = []
    for lap_number in sorted(shared_laps):
        try:
            target_data, _ = _load_lap(laps, target_driver, session_key, lap_number)
            benchmark_data, _ = _load_lap(laps, benchmark_driver, session_key, lap_number)
        except HTTPException:
            continue
        has_shared_corner = False
        for corner in CORNERS:
            if _corner_metrics(target_data, corner) is not None and _corner_metrics(benchmark_data, corner) is not None:
                has_shared_corner = True
                break
        if has_shared_corner:
            valid_laps.append(lap_number)

    return {
        "session_key": int(session_key),
        "target_driver": int(target_driver),
        "benchmark_driver": int(benchmark_driver),
        "through_lap": through_lap,
        "laps": valid_laps,
    }


def _recent_trend(comparisons: list[dict[str, Any]]) -> str | None:
    losses = [comparison.get("top_losses", []) for comparison in comparisons]
    if len(losses) < 2:
        return None
    latest = losses[-1][0] if losses[-1] else None
    previous = losses[-2][0] if losses[-2] else None
    if latest and previous and latest["corner"] == previous["corner"] and latest["time_loss"] < previous["time_loss"]:
        return f"{latest['corner']} is improving."
    if latest and previous and latest["corner"] != previous["corner"]:
        return f"{latest['corner']} is now the primary deficit."
    return "Recent corner losses are being monitored across the completed laps."


def get_default_benchmark_driver(session_key: int, target_driver: int) -> int:
    laps = load_laps()
    valid = laps[
        (laps["session_key"] == session_key)
        & (laps["driver_number"] != target_driver)
        & laps["lap_duration"].notna()
    ]
    if valid.empty:
        raise HTTPException(status_code=404, detail="No valid benchmark driver is available")
    scores = valid.groupby("driver_number")["lap_duration"].median().sort_values()
    return int(scores.index[0])
