"""Compose existing live, voice, race-context, and gate outputs into a timeline."""

import hashlib
from typing import Any
from urllib.parse import urlencode

from services.live_analysis import get_live_analysis
from services.voice import get_voice_intelligence
from services.tyre_state import get_driver_tyre_state
from services.tyre_strategy import simulate_strategies


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


_timeline_cache: dict[tuple[int, int], dict[str, Any]] = {}


def get_race_timeline(session_key: int, driver_number: int) -> dict[str, Any]:
    cache_key = (session_key, driver_number)
    if cache_key in _timeline_cache:
        return _timeline_cache[cache_key]

    live_data = get_live_analysis(session_key, driver_number)
    voice_data = get_voice_intelligence(session_key, driver_number)
    samples = sorted(live_data.get("samples", []), key=lambda sample: sample.get("elapsed", 0))
    events: list[dict[str, Any]] = []

    # Map earliest sample per lap for clean timeline temporal alignment
    lap_start_samples: dict[int, dict[str, Any]] = {}
    for s in samples:
        l_num = s.get("lap_number")
        if l_num is not None and l_num not in lap_start_samples:
            lap_start_samples[l_num] = s

    last_section: tuple[Any, Any] | None = None
    last_diagnosis: tuple[Any, Any] | None = None
    last_gate_state: str | None = None
    last_race_state: tuple[Any, Any, Any] | None = None
    last_position_event: str | None = None
    last_tyre_alert_lap: int | None = None

    for sample in samples:
        elapsed = float(sample.get("elapsed", 0))
        context = _context_from_sample(sample)
        corner = context.get("corner")
        phase = context.get("phase")
        diagnosis = context["performance"].get("diagnosis")
        race = context.get("race_context", {})
        communication = context.get("communication") or {}
        current_lap = context.get("lap")

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

                # Check if this escalation was triggered by TYRE_ALERT
                if (communication.get("category") == "TYRE_ALERT" or sample.get("tyre_alert_active")) and current_lap != last_tyre_alert_lap:
                    tyre_alert_event = _base_event(
                        "TYRE_ALERT_ESCALATION",
                        elapsed,
                        context,
                        "TYRE ALERT ESCALATION",
                        "Communication gate escalated to RADIO_NOW due to critical tyre degradation threshold",
                        f"tyre_alert|{current_lap}|{corner}",
                    )
                    tyre_alert_event["links"] = {
                        "live": _live_link(session_key, driver_number, tyre_alert_event),
                        "tyre": f"/tyres?session={session_key}&driver={driver_number}&lap={current_lap}",
                    }
                    events.append(tyre_alert_event)
                    last_tyre_alert_lap = current_lap

        last_gate_state = gate_state

    # 1. Weave in Voice Radio Transmissions
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
            "links": {
                "live": _live_link(session_key, driver_number, radio),
                "voice": _voice_link(session_key, driver_number, radio),
                "tyre": f"/tyres?session={session_key}&driver={driver_number}" + (f"&lap={radio['lap']}" if radio.get("lap") else ""),
            },
        }
        events.append(radio_event)

    # 2. Weave in First-Class Tyre Degradation Events (Cliff Onset & Pit Window)
    try:
        tyre_state = get_driver_tyre_state(session_key, driver_number)
        records = tyre_state.get("records", [])

        # Find first cliff lap per stint (e.g. cliff_probability >= 0.50 or cliff_detected)
        cliff_laps_found: set[int] = set()
        stints_processed: set[int] = set()

        for rec in records:
            stint_num = rec.get("stint_number", 1)
            cliff_prob = rec.get("cliff_probability", 0.0)
            cliff_det = rec.get("cliff_detected", False)
            lap_num = rec.get("lap_number")

            if stint_num not in stints_processed and (cliff_det or cliff_prob >= 0.50) and lap_num is not None:
                stints_processed.add(stint_num)
                cliff_laps_found.add(lap_num)

                sample_ref = lap_start_samples.get(lap_num) or (samples[0] if samples else {})
                t_elapsed = float(sample_ref.get("elapsed", 0))
                t_ctx = _context_from_sample(sample_ref)

                cliff_ev = _base_event(
                    "TYRE_CLIFF_ONSET",
                    t_elapsed,
                    t_ctx,
                    "TYRE CLIFF ONSET",
                    f"Stint {stint_num} ({rec.get('compound', 'TYRE')}) reached degradation cliff inflection (wear rate +{rec.get('wear_rate_estimate', 0):.3f}s/lap, cliff risk {int(cliff_prob * 100)}%)",
                    f"cliff|stint{stint_num}|lap{lap_num}",
                )
                cliff_ev["links"] = {
                    "live": _live_link(session_key, driver_number, cliff_ev),
                    "tyre": f"/tyres?session={session_key}&driver={driver_number}&lap={lap_num}",
                }
                events.append(cliff_ev)

        # 3. Weave in Nominal Pit Window Opened Event
        try:
            strat = simulate_strategies(session_key, driver_number, current_lap=38)
            scenarios = strat.get("scenarios", [])
            nominal = next((s for s in scenarios if s.get("name") == "Nominal"), None)
            if nominal:
                pit_lap = nominal.get("pit_lap", 41)
                window_lap = max(1, pit_lap - 2)
                sample_ref = lap_start_samples.get(window_lap) or (samples[0] if samples else {})
                t_elapsed = float(sample_ref.get("elapsed", 0))
                t_ctx = _context_from_sample(sample_ref)

                pit_ev = _base_event(
                    "PIT_WINDOW_OPENED",
                    t_elapsed,
                    t_ctx,
                    "PIT WINDOW OPENED",
                    f"Optimal pit window opened for Stint 1 ({strat.get('current_compound', 'HARD')}) · Target Box: Lap {pit_lap} for {nominal.get('new_compound', 'MEDIUM')} tyres",
                    f"pit_window|lap{window_lap}",
                )
                pit_ev["links"] = {
                    "live": _live_link(session_key, driver_number, pit_ev),
                    "tyre": f"/tyres?session={session_key}&driver={driver_number}&lap={pit_lap}",
                }
                events.append(pit_ev)
        except Exception as pit_err:
            print("Pit window calculation skipped:", pit_err)

    except Exception as tyre_err:
        print("Tyre timeline event generation error:", tyre_err)

    kind_order = {
        "TELEMETRY": 0,
        "RADIO": 1,
        "RACE_CONTEXT": 2,
        "COMMUNICATION": 3,
        "CO_DRIVER": 4,
        "PIT_WINDOW_OPENED": 5,
        "TYRE_CLIFF_ONSET": 6,
        "TYRE_ALERT_ESCALATION": 7,
    }
    events.sort(key=lambda event: (event["elapsed"], kind_order.get(event["kind"], 99)))
    result = {
        "session_key": session_key,
        "driver_number": driver_number,
        "events": events,
    }
    _timeline_cache[cache_key] = result
    return result

