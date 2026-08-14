"""Compose existing live, voice, race-context, and gate outputs into a timeline."""

import hashlib
from typing import Any
from urllib.parse import urlencode

from services.live_analysis import get_live_analysis
from services.voice import get_voice_intelligence


ACTIONABLE_DIAGNOSES = {
    "EARLY_BRAKING",
    "LOW_ENTRY_SPEED",
    "LOW_MIN_SPEED",
    "LATE_THROTTLE",
    "LOW_EXIT_SPEED",
}


def _timeline_id(kind: str, elapsed: float, lap: int | None, corner: str | None, suffix: str) -> str:
    canonical = f"{kind}|{elapsed:.3f}|{lap or ''}|{corner or ''}|{suffix}"
    digest = hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:16]
    return f"timeline_{digest}"


def _timecode(elapsed: float) -> str:
    total_seconds = max(0, int(round(elapsed)))
    minutes, seconds = divmod(total_seconds, 60)
    return f"T+{minutes:02d}:{seconds:02d}"


def _context_from_sample(sample: dict[str, Any]) -> dict[str, Any]:
    corner = sample.get("current_corner", {})
    analysis = sample.get("analysis", {})
    comparison = sample.get("comparison", {})
    return {
        "lap": sample.get("lap_number"),
        "corner": corner.get("name"),
        "phase": corner.get("phase"),
        "progress": sample.get("progress"),
        "performance": {
            "entry_speed_delta": comparison.get("entry_speed_delta"),
            "minimum_speed_delta": comparison.get("minimum_speed_delta"),
            "exit_speed_delta": comparison.get("exit_speed_delta"),
            "diagnosis": analysis.get("diagnosis"),
            "estimated_time_delta": analysis.get("estimated_time_delta"),
            "confidence": analysis.get("confidence"),
        },
        "race_context": sample.get("race_context") or {},
        "communication": sample.get("communication"),
    }


def _base_event(kind: str, elapsed: float, context: dict[str, Any], title: str, summary: str, suffix: str) -> dict[str, Any]:
    return {
        "event_id": _timeline_id(kind, elapsed, context.get("lap"), context.get("corner"), suffix),
        "kind": kind,
        "elapsed": round(elapsed, 3),
        "timecode": _timecode(elapsed),
        "timestamp": None,
        "lap": context.get("lap"),
        "corner": context.get("corner"),
        "phase": context.get("phase"),
        "progress": context.get("progress"),
        "title": title,
        "summary": summary,
        "performance": context.get("performance", {}),
        "race_context": context.get("race_context", {}),
        "communication": context.get("communication"),
        "radio": None,
    }


def _diagnosis_summary(context: dict[str, Any]) -> str:
    performance = context["performance"]
    diagnosis = performance.get("diagnosis") or "NO SIGNIFICANT DEFICIT"
    entry_delta = performance.get("entry_speed_delta")
    time_loss = performance.get("estimated_time_delta")
    parts = [diagnosis.replace("_", " ")]
    if entry_delta is not None:
        parts.append(f"entry {entry_delta:+g} km/h")
    if time_loss is not None and time_loss != 0:
        parts.append(f"{time_loss:+.3f}s")
    return " · ".join(parts)


def _live_link(session_key: int, driver_number: int, event: dict[str, Any]) -> str:
    params = {
        "session": session_key,
        "driver": driver_number,
    }
    if event.get("lap") is not None:
        params["lap"] = event["lap"]
    if event.get("progress") is not None:
        params["progress"] = f"{float(event['progress']):.6f}"
    if event.get("corner"):
        params["corner"] = event["corner"]
    return f"/live?{urlencode(params)}"


def _voice_link(session_key: int, driver_number: int, event: dict[str, Any]) -> str:
    params = {
        "session": session_key,
        "driver": driver_number,
        "event_id": event["event_id"],
    }
    if event.get("lap") is not None:
        params["lap"] = event["lap"]
    if event.get("corner"):
        params["corner"] = event["corner"]
    if event.get("progress") is not None:
        params["progress"] = f"{float(event['progress']):.6f}"
    if event.get("elapsed") is not None:
        params["elapsed"] = f"{float(event['elapsed']):.3f}"
    if event.get("timestamp"):
        params["timestamp"] = event["timestamp"]
    return f"/voice?{urlencode(params)}"


def get_race_timeline(session_key: int, driver_number: int) -> dict[str, Any]:
    live_data = get_live_analysis(session_key, driver_number)
    voice_data = get_voice_intelligence(session_key, driver_number)
    samples = sorted(live_data.get("samples", []), key=lambda sample: sample.get("elapsed", 0))
    events: list[dict[str, Any]] = []

    last_section: tuple[Any, Any] | None = None
    last_diagnosis: tuple[Any, Any] | None = None
    last_gate_state: str | None = None
    last_race_state: tuple[Any, Any, Any] | None = None
    last_position_event: str | None = None

    for sample in samples:
        elapsed = float(sample.get("elapsed", 0))
        context = _context_from_sample(sample)
        corner = context.get("corner")
        phase = context.get("phase")
        diagnosis = context["performance"].get("diagnosis")
        race = context.get("race_context", {})
        communication = context.get("communication") or {}

        section_key = (corner, phase)
        if corner and corner != "Straight" and section_key != last_section:
            section_event = _base_event(
                "TELEMETRY",
                elapsed,
                context,
                f"{corner} {phase}",
                _diagnosis_summary(context),
                f"section|{corner}|{phase}",
            )
            section_event["links"] = {"live": _live_link(session_key, driver_number, section_event)}
            events.append(section_event)
        last_section = section_key

        diagnosis_key = (corner, diagnosis)
        if diagnosis in ACTIONABLE_DIAGNOSES and diagnosis_key != last_diagnosis:
            diagnosis_event = _base_event(
                "TELEMETRY",
                elapsed,
                context,
                diagnosis.replace("_", " "),
                _diagnosis_summary(context),
                f"diagnosis|{corner}|{diagnosis}",
            )
            diagnosis_event["links"] = {"live": _live_link(session_key, driver_number, diagnosis_event)}
            events.append(diagnosis_event)
        last_diagnosis = diagnosis_key

        race_state = (
            race.get("position"),
            race.get("battle_active", False),
            race.get("is_defending", False),
        )
        position_event = race.get("position_event")
        if position_event and position_event != "NO_CHANGE" and position_event != last_position_event:
            race_event = _base_event(
                "RACE_CONTEXT",
                elapsed,
                context,
                position_event.replace("_", " "),
                f"P{race.get('position')}" if race.get("position") is not None else "Position update",
                f"position|{position_event}|{race.get('position')}",
            )
            race_event["links"] = {"live": _live_link(session_key, driver_number, race_event)}
            events.append(race_event)
        elif race_state != last_race_state and race.get("battle_active"):
            race_event = _base_event(
                "RACE_CONTEXT",
                elapsed,
                context,
                "DEFENDING" if race.get("is_defending") else "BATTLE ACTIVE",
                f"P{race.get('position')} · {race.get('gap_behind')}s behind" if race.get("gap_behind") is not None else "Battle context active",
                f"battle|{race_state}",
            )
            race_event["links"] = {"live": _live_link(session_key, driver_number, race_event)}
            events.append(race_event)
        last_race_state = race_state
        last_position_event = position_event if position_event != "NO_CHANGE" else None

        gate_state = communication.get("state", "MONITORING")
        if gate_state != last_gate_state and gate_state != "MONITORING":
            gate_event = _base_event(
                "COMMUNICATION",
                elapsed,
                context,
                gate_state.replace("_", " "),
                communication.get("reason") or "Communication gate escalated",
                f"gate|{gate_state}|{corner}",
            )
            gate_event["links"] = {"live": _live_link(session_key, driver_number, gate_event)}
            events.append(gate_event)
            if gate_state == "RADIO_NOW":
                co_driver_event = _base_event(
                    "CO_DRIVER",
                    elapsed,
                    context,
                    "CO-DRIVER",
                    sample.get("analysis", {}).get("advice") or "Instruction available",
                    f"co-driver|{corner}|{diagnosis}",
                )
                co_driver_event["details"] = {
                    "observation": sample.get("analysis", {}).get("message"),
                    "advice": sample.get("analysis", {}).get("advice"),
                }
                co_driver_event["links"] = {"live": _live_link(session_key, driver_number, co_driver_event)}
                events.append(co_driver_event)
        last_gate_state = gate_state

    for radio in voice_data.get("messages", []):
        if radio.get("elapsed") is None:
            continue
        radio_event = {
            "event_id": radio["event_id"],
            "kind": "RADIO",
            "elapsed": radio["elapsed"],
            "timecode": _timecode(float(radio["elapsed"])),
            "timestamp": radio.get("timestamp"),
            "lap": radio.get("lap"),
            "corner": radio.get("corner"),
            "phase": radio.get("phase"),
            "progress": radio.get("progress"),
            "title": "RADIO",
            "summary": radio.get("transcript") or "Transcript unavailable",
            "performance": radio.get("performance", {}),
            "race_context": radio.get("race_context", {}),
            "communication": radio.get("communication"),
            "radio": {
                "transcript": radio.get("transcript"),
                "voice_state": radio.get("voice", {}).get("voice_state"),
                "emotion": radio.get("voice", {}).get("emotion"),
            },
            "links": {"live": _live_link(session_key, driver_number, radio), "voice": _voice_link(session_key, driver_number, radio)},
        }
        events.append(radio_event)

    kind_order = {"TELEMETRY": 0, "RADIO": 1, "RACE_CONTEXT": 2, "COMMUNICATION": 3, "CO_DRIVER": 4}
    events.sort(key=lambda event: (event["elapsed"], kind_order.get(event["kind"], 99)))
    return {
        "session_key": session_key,
        "driver_number": driver_number,
        "events": events,
    }
