import pandas as pd
import numpy as np
import os
import json
from fastapi import HTTPException
from data.singapore_2023_track import CORNERS
from services.race_engineer import generate_race_engineer_advice
from services.race_context import get_race_context
from services.tyre_state import get_driver_tyre_state

LLM_CACHE_FILE = os.path.join(os.path.dirname(__file__), "llm_cache.json")
llm_cache_global = {}
if os.path.exists(LLM_CACHE_FILE):
    try:
        with open(LLM_CACHE_FILE, "r") as f:
            llm_cache_global = json.load(f)
    except Exception as e:
        print(f"Failed to load LLM cache: {e}")

_cache = {}

def get_base_dir():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_laps():
    if 'laps' in _cache:
        return _cache['laps']
    laps_path = os.path.join(get_base_dir(), "data", "laps.csv")
    if not os.path.exists(laps_path):
        raise HTTPException(status_code=500, detail="laps.csv not found")
    df = pd.read_csv(laps_path)
    df['date_start'] = pd.to_datetime(df['date_start'], errors='coerce')
    _cache['laps'] = df
    return df

def find_benchmark_driver(session_key, lap_number, target_driver):
    laps = load_laps()
    lap_data = laps[(laps['session_key'] == session_key) & (laps['lap_number'] == lap_number) & (laps['driver_number'] != target_driver)]
    valid_laps = lap_data.dropna(subset=['lap_duration'])
    if valid_laps.empty:
        return 4 if target_driver != 4 else 55
    benchmark_driver = valid_laps.loc[valid_laps['lap_duration'].idxmin()]['driver_number']
    return int(benchmark_driver)

def load_driver_data(driver_number):
    if f'data_{driver_number}' in _cache:
        return _cache[f'data_{driver_number}']

    base_dir = get_base_dir()
    loc_path = os.path.join(base_dir, "data", f"location_{driver_number}.csv")
    car_path = os.path.join(base_dir, "data", f"car_data_{driver_number}.csv")

    if not os.path.exists(loc_path) or not os.path.exists(car_path):
        return None

    loc_df = pd.read_csv(loc_path)
    car_df = pd.read_csv(car_path)

    loc_df['date'] = pd.to_datetime(loc_df['date'], errors='coerce')
    car_df['date'] = pd.to_datetime(car_df['date'], errors='coerce')

    loc_df = loc_df.sort_values('date').dropna(subset=['date'])
    car_df = car_df.sort_values('date').dropna(subset=['date'])

    merged_df = pd.merge_asof(loc_df, car_df, on='date', direction='nearest')

    _cache[f'data_{driver_number}'] = merged_df
    return merged_df

def calculate_progress(lap_df):
    coords = lap_df[['x', 'y']].to_numpy()
    if len(coords) < 2:
        lap_df['progress'] = 0.0
        return lap_df

    diffs = np.diff(coords, axis=0)
    dists = np.linalg.norm(diffs, axis=1)
    cum_dists = np.concatenate(([0], np.cumsum(dists)))
    total_dist = cum_dists[-1]
    if total_dist == 0:
        lap_df['progress'] = 0.0
    else:
        lap_df['progress'] = cum_dists / total_dist
    return lap_df


def _sanitize_straight_analysis(result):
    """Prevent corner findings from leaking into straight sections."""
    for sample in result.get("samples", []):
        if sample.get("current_corner", {}).get("name") == "Straight":
            sample["analysis"] = {
                "diagnosis": "NONE",
                "severity": "low",
                "estimated_time_delta": None,
                "confidence": None,
                "message": "No corner diagnosis in this section.",
                "advice": "No driver instruction required.",
            }
    return result


def _apply_communication_gate(all_samples: list, session_key: int, target_driver: int) -> list:
    """
    Apply multi-modal communication gate across all samples, enforcing persistence,
    cooldowns, and routing for driving, strategic, and TYRE_ALERT events.
    """
    MIN_RADIO_CONFIDENCE = 0.80
    MIN_RADIO_TIME_LOSS = 0.10
    HIGH_SEVERITY_TIME_LOSS = 0.20
    MIN_RADIO_PERSISTENCE = 2  # consecutive laps
    RADIO_COOLDOWN_SECONDS = 20
    MATERIAL_WORSENING_DELTA = 0.10

    corner_history = {} # corner_diagnosis -> { "last_lap": lap, "consecutive_laps": N }
    dedup_last_communicated_loss = {} # corner_diagnosis -> last communicated time loss
    cooldowns = {} # corner_diagnosis -> next_allowed_time
    llm_cache = llm_cache_global

    active_radio_event = None

    # Pre-fetch latent tyre state and cliff detection data
    tyre_state_data = {}
    try:
        tyre_state_data = get_driver_tyre_state(session_key, target_driver)
    except Exception as e:
        print(f"Tyre state retrieval error: {e}")
    tyre_lap_lookup = tyre_state_data.get("lap_lookup", {})
    tyre_stints_meta = tyre_state_data.get("stints", {})

    for sample in all_samples:
        elapsed = sample["elapsed"]
        lap = sample["lap_number"]
        corner = sample.get("current_corner", {}).get("name", "Straight")
        analysis = sample["analysis"]
        diag = analysis.get("diagnosis", "GOOD")
        time_loss = analysis.get("estimated_time_delta", 0)
        confidence = analysis.get("confidence", 1.0)

        # Check tyre degradation and cliff risk
        tyre_rec = tyre_lap_lookup.get(lap)
        cliff_prob = tyre_rec.get("cliff_probability", 0.0) if tyre_rec else 0.0
        tyre_conf = tyre_rec.get("confidence", "INSUFFICIENT_EVIDENCE") if tyre_rec else "INSUFFICIENT_EVIDENCE"
        wear_rate = tyre_rec.get("wear_rate_estimate", 0.0) if tyre_rec else 0.0
        stint_num = tyre_rec.get("stint_number", 1) if tyre_rec else 1

        baseline_wear = 0.035
        if stint_num in tyre_stints_meta:
            baseline_wear = tyre_stints_meta[stint_num].get("baseline_wear_rate", 0.035)

        is_tyre_alert_condition = bool(
            (cliff_prob >= 0.50) or
            (tyre_conf == "HIGH_CONFIDENCE" and wear_rate >= 2.0 * baseline_wear)
        )

        # Attach real-time tyre telemetry to sample for shared-clock HUD rendering
        sample["tyre_wear_rate"] = round(wear_rate, 4)
        sample["cliff_probability"] = round(cliff_prob, 3)
        sample["tyre_alert_active"] = is_tyre_alert_condition

        dedup_key = f"TYRE_ALERT_stint_{stint_num}" if is_tyre_alert_condition else f"{corner}_{diag}"

        comm = {
            "state": "MONITORING",
            "should_speak": False,
            "priority": None,
            "category": "TYRE_ALERT" if is_tyre_alert_condition else "DRIVING",
            "reason": None,
            "cooldown_remaining": max(0, cooldowns.get(dedup_key, 0) - elapsed)
        }

        race_ctx = sample.get("race_context", {})
        has_race_event = race_ctx.get("battle_active", False) or race_ctx.get("position_event", "NO_CHANGE") != "NO_CHANGE"

        if not is_tyre_alert_condition and (diag in {"GOOD", "None", "NONE"} or corner == "Straight") and not has_race_event:
            sample["communication"] = comm
            active_radio_event = None
            continue

        comm["state"] = "ATTENTION"

        # Track persistence by lap
        hist = corner_history.get(dedup_key, {"last_lap": 0, "consecutive_laps": 0})
        if hist["last_lap"] != lap:
            if hist["last_lap"] == lap - 1:
                hist["consecutive_laps"] += 1
            else:
                hist["consecutive_laps"] = 1
            hist["last_lap"] = lap
            corner_history[dedup_key] = hist

        consecutive_laps = corner_history[dedup_key]["consecutive_laps"]

        if active_radio_event == dedup_key:
            comm["state"] = "RADIO_NOW"
            comm["should_speak"] = True
            comm["cooldown_remaining"] = max(0, cooldowns.get(dedup_key, 0) - elapsed)

            if is_tyre_alert_condition:
                comm["category"] = "TYRE_ALERT"
                comm["priority"] = "HIGH" if cliff_prob >= 0.80 else "MEDIUM"
                comm["reason"] = f"Tyre cliff alert (Cliff prob: {cliff_prob * 100:.0f}%, wear: {wear_rate:.3f}s/lap)"
                sample["analysis"]["diagnosis"] = "TYRE_CLIFF_ALERT"
                sample["analysis"]["message"] = f"Tyre degradation alert: cliff probability {cliff_prob * 100:.0f}%, wear rate {wear_rate:.3f}s/lap."
                sample["analysis"]["advice"] = "Tyre cliff imminent. Prepare for pit stop or switch to tyre management delta."
            elif dedup_key in llm_cache:
                corner_response = llm_cache[dedup_key]
                sample["analysis"]["message"] = corner_response.get("message", "Observation logged.")
                sample["analysis"]["advice"] = corner_response.get("advice", "Keep pushing.")

            sample["communication"] = comm
            continue

        # Check triggers
        safe_confidence = confidence if confidence is not None else 0.0
        meets_confidence = safe_confidence >= MIN_RADIO_CONFIDENCE
        meets_moderate = (time_loss is not None and time_loss >= MIN_RADIO_TIME_LOSS and consecutive_laps >= MIN_RADIO_PERSISTENCE)
        meets_immediate = (time_loss is not None and time_loss >= HIGH_SEVERITY_TIME_LOSS)
        meets_strategic = has_race_event and (corner == "Straight" or diag in {"GOOD", "None", "NONE"})
        meets_tyre = is_tyre_alert_condition and (consecutive_laps >= MIN_RADIO_PERSISTENCE or cliff_prob >= 0.80)

        if (meets_confidence and (meets_moderate or meets_immediate)) or meets_strategic or meets_tyre:
            last_loss = dedup_last_communicated_loss.get(dedup_key, 0)
            materially_worse = (time_loss is not None and time_loss >= last_loss + MATERIAL_WORSENING_DELTA)
            on_cooldown = elapsed < cooldowns.get(dedup_key, 0)

            can_speak = False
            if materially_worse or meets_tyre:
                can_speak = not on_cooldown
            elif not on_cooldown:
                can_speak = True

            if can_speak:
                comm["state"] = "RADIO_NOW"
                comm["should_speak"] = True
                comm["priority"] = "HIGH" if (meets_immediate or cliff_prob >= 0.80) else "MEDIUM"

                if meets_tyre:
                    comm["category"] = "TYRE_ALERT"
                    comm["reason"] = f"Tyre cliff alert (Cliff prob: {cliff_prob * 100:.0f}%, wear: {wear_rate:.3f}s/lap)"
                elif meets_strategic:
                    comm["reason"] = "Strategic race context"
                else:
                    comm["reason"] = f"{diag} at {corner} ({time_loss:.2f}s loss)"

                cooldowns[dedup_key] = elapsed + RADIO_COOLDOWN_SECONDS
                comm["cooldown_remaining"] = RADIO_COOLDOWN_SECONDS
                dedup_last_communicated_loss[dedup_key] = time_loss if time_loss is not None else 0.0
                active_radio_event = dedup_key

                if meets_tyre:
                    sample["analysis"]["diagnosis"] = "TYRE_CLIFF_ALERT"
                    sample["analysis"]["message"] = f"Tyre degradation alert: cliff probability is {cliff_prob * 100:.0f}% with wear rate {wear_rate:.3f}s/lap."
                    sample["analysis"]["advice"] = "Tyre cliff imminent. Prepare for pit stop or switch to tyre management delta."
                else:
                    metrics_dict = {
                        corner: {
                            "entry_speed_delta": sample.get("comparison", {}).get("entry_speed_delta", 0),
                            "minimum_speed_delta": sample.get("comparison", {}).get("minimum_speed_delta", 0),
                            "exit_speed_delta": sample.get("comparison", {}).get("exit_speed_delta", 0),
                            "braking_delta": sample.get("comparison", {}).get("braking_delta", 0),
                            "throttle_delay": sample.get("comparison", {}).get("throttle_delay", 0),
                            "diagnosis": diag,
                            "time_loss": time_loss,
                            "race_context": sample.get("race_context", {})
                        }
                    }

                    if dedup_key in llm_cache:
                        corner_response = llm_cache[dedup_key]
                    else:
                        llm_response = generate_race_engineer_advice(metrics_dict)
                        corner_response = llm_response.get(corner, {})
                        llm_cache[dedup_key] = corner_response

                        try:
                            with open(LLM_CACHE_FILE, "w") as f:
                                json.dump(llm_cache, f)
                        except Exception as e:
                            pass

                    if corner_response:
                        sample["analysis"]["message"] = corner_response.get("message", "Observation logged.")
                        sample["analysis"]["advice"] = corner_response.get("advice", "Keep pushing.")

        sample["communication"] = comm

    return all_samples


def get_live_analysis(session_key: int, target_driver: int):
    cache_key = f"live_analysis_{session_key}_{target_driver}"
    if cache_key in _cache:
        return _cache[cache_key]

    cache_file = os.path.join(get_base_dir(), "data", f"cache_{session_key}_{target_driver}.json")
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            result = json.load(f)
            result = _sanitize_straight_analysis(result)
            result["samples"] = _apply_communication_gate(result.get("samples", []), session_key, target_driver)
            _cache[cache_key] = result
            return result

    laps_df = load_laps()
    target_df = load_driver_data(target_driver)

    if target_df is None:
        raise HTTPException(status_code=404, detail="Target driver data not found")

    target_laps = laps_df[(laps_df['session_key'] == session_key) & (laps_df['driver_number'] == target_driver)].sort_values('lap_number')

    if target_laps.empty:
        raise HTTPException(status_code=404, detail="No laps found for target driver")

    session_start_time = target_laps.iloc[0]['date_start']

    all_samples = []

    for idx, target_lap_row in target_laps.iterrows():
        lap_number = target_lap_row['lap_number']
        benchmark_driver = find_benchmark_driver(session_key, lap_number, target_driver)
        benchmark_df = load_driver_data(benchmark_driver)

        if benchmark_df is None:
            continue

        t_start = target_lap_row['date_start']
        t_dur = target_lap_row['lap_duration']
        t_end = t_start + pd.Timedelta(seconds=float(t_dur) if not pd.isna(t_dur) else 100)
        t_lap_df = target_df[(target_df['date'] >= t_start) & (target_df['date'] < t_end)].copy()

        bmk_lap_row = laps_df[(laps_df['session_key'] == session_key) & (laps_df['driver_number'] == benchmark_driver) & (laps_df['lap_number'] == lap_number)]
        if bmk_lap_row.empty:
            continue

        b_start = bmk_lap_row.iloc[0]['date_start']
        b_dur = bmk_lap_row.iloc[0]['lap_duration']
        b_end = b_start + pd.Timedelta(seconds=float(b_dur) if not pd.isna(b_dur) else 100)
        b_lap_df = benchmark_df[(benchmark_df['date'] >= b_start) & (benchmark_df['date'] < b_end)].copy()

        if t_lap_df.empty or b_lap_df.empty:
            continue

        t_lap_df = calculate_progress(t_lap_df)
        b_lap_df = calculate_progress(b_lap_df)

        # Calculate elapsed relative to the very start of the session (Lap 1)
        t_lap_df['elapsed'] = (t_lap_df['date'] - session_start_time).dt.total_seconds()
        b_lap_df['elapsed_bmk'] = (b_lap_df['date'] - session_start_time).dt.total_seconds()

        t_lap_df = t_lap_df.sort_values('progress')
        b_lap_df = b_lap_df.sort_values('progress')

        t_lap_df['progress_float'] = t_lap_df['progress'].astype(float)
        b_lap_df['progress_float'] = b_lap_df['progress'].astype(float)

        synced = pd.merge_asof(t_lap_df, b_lap_df, on='progress_float', direction='nearest', suffixes=('', '_bmk'))

        all_contexts = get_race_context(session_key, target_driver, synced['date'])
        synced['race_context'] = all_contexts

        # Use global bounds from the entire target_df so coordinates don't shift lap by lap
        min_x = target_df['x'].min()
        max_x = target_df['x'].max()
        min_y = target_df['y'].min()
        max_y = target_df['y'].max()
        x_range = max_x - min_x if max_x != min_x else 1
        y_range = max_y - min_y if max_y != min_y else 1

        corner_metrics = {}
        for c in CORNERS:
            c_df = synced[(synced['progress'] >= c['start']) & (synced['progress'] <= c['end'])]
            if len(c_df) < 5:
                continue

            t_time = c_df.iloc[-1]['elapsed'] - c_df.iloc[0]['elapsed']
            b_time = c_df.iloc[-1]['elapsed_bmk'] - c_df.iloc[0]['elapsed_bmk']
            est_time_delta = float(t_time - b_time)

            t_entry = c_df.iloc[0]['speed']
            b_entry = c_df.iloc[0]['speed_bmk']

            t_min = c_df['speed'].min()
            b_min = c_df['speed_bmk'].min()

            t_exit = c_df.iloc[-1]['speed']
            b_exit = c_df.iloc[-1]['speed_bmk']

            t_brake_idx = c_df[c_df['brake'] > 0]['progress'].min()
            b_brake_idx = c_df[c_df['brake_bmk'] > 0]['progress'].min()
            t_brake_prog = t_brake_idx if not pd.isna(t_brake_idx) else c['braking_start']
            b_brake_prog = b_brake_idx if not pd.isna(b_brake_idx) else c['braking_start']

            apex_df = c_df[c_df['progress'] >= c['apex']]
            t_thr_idx = apex_df[apex_df['throttle'] > 50]['progress'].min()
            b_thr_idx = apex_df[apex_df['throttle_bmk'] > 50]['progress'].min()
            t_thr_prog = t_thr_idx if not pd.isna(t_thr_idx) else c['exit']
            b_thr_prog = b_thr_idx if not pd.isna(b_thr_idx) else c['exit']

            entry_speed_delta = int(t_entry - b_entry)
            min_speed_delta = int(t_min - b_min)
            exit_speed_delta = int(t_exit - b_exit)
            braking_progress_delta = float(t_brake_prog - b_brake_prog)
            throttle_delay = float(t_thr_prog - b_thr_prog)

            diagnosis = "GOOD"
            advice = "Sectors clear. Keep pushing."
            severity = "low"

            if braking_progress_delta < -0.005 and entry_speed_delta < -5:
                diagnosis = "EARLY_BRAKING"
                severity = "high"
                advice = f"You're braking early into {c['name']}. Carry more speed deeper into the corner."
            elif entry_speed_delta < -10:
                diagnosis = "LOW_ENTRY_SPEED"
                severity = "high"
                advice = f"You're entering {c['name']} too slowly. Carry more speed into the corner."
            elif min_speed_delta < -7:
                diagnosis = "LOW_MIN_SPEED"
                severity = "medium"
                advice = f"You're losing speed through {c['name']}. Focus on maintaining momentum through rotation."
            elif throttle_delay > 0.005:
                diagnosis = "LATE_THROTTLE"
                severity = "medium"
                advice = f"You're getting back to throttle late in {c['name']}. Prioritize earlier throttle application on exit."
            elif exit_speed_delta < -8:
                diagnosis = "LOW_EXIT_SPEED"
                severity = "medium"
                advice = f"Your {c['name']} exit is costing time. Focus on earlier acceleration."

            corner_metrics[c['name']] = {
                "entry_speed_delta": entry_speed_delta,
                "minimum_speed_delta": min_speed_delta,
                "exit_speed_delta": exit_speed_delta,
                "braking_delta": round(braking_progress_delta, 4),
                "throttle_delay": round(throttle_delay, 4),
                "diagnosis": diagnosis,
                "severity": severity,
                "advice": advice,
                "time_loss": round(est_time_delta, 3),
                "race_context": c_df.iloc[-1]['race_context']
            }

        # The LLM Reasoning Layer has been decoupled. The frontend will hit /api/race-engineer on demand.
        last_meaningful_advice = None

        synced = synced.sort_values('elapsed') # Ensure chronological order within the lap

        for _, row in synced.iterrows():
            prog = row['progress']

            current_corner = "Straight"
            phase = "STRAIGHT"

            for c in CORNERS:
                if c['start'] <= prog <= c['end']:
                    current_corner = c['name']
                    if prog < c['braking_start']:
                        phase = "APPROACH"
                    elif prog < c['apex']:
                        phase = "BRAKING"
                    elif prog < c['exit']:
                        phase = "CORNER"
                    else:
                        phase = "EXIT"
                    break

            metrics = corner_metrics.get(current_corner)

            if current_corner == "Straight":
                comp = {
                    "entry_speed_delta": 0, "minimum_speed_delta": 0, "exit_speed_delta": 0,
                    "braking_delta": 0, "throttle_delay": 0
                }
                analysis = {
                    "diagnosis": "NONE",
                    "severity": "low",
                    "estimated_time_delta": None,
                    "confidence": None,
                    "message": "No corner diagnosis in this section.",
                    "advice": "No driver instruction required.",
                }
            elif metrics:
                comp = {
                    "entry_speed_delta": metrics["entry_speed_delta"],
                    "minimum_speed_delta": metrics["minimum_speed_delta"],
                    "exit_speed_delta": metrics["exit_speed_delta"],
                    "braking_delta": metrics["braking_delta"],
                    "throttle_delay": metrics["throttle_delay"]
                }
                analysis = {
                    "diagnosis": metrics["diagnosis"],
                    "severity": metrics["severity"],
                    "estimated_time_delta": metrics["time_loss"],
                    "confidence": 0.85,
                    "advice": metrics["advice"]
                }
                last_meaningful_advice = analysis
            else:
                comp = {
                    "entry_speed_delta": 0, "minimum_speed_delta": 0, "exit_speed_delta": 0,
                    "braking_delta": 0, "throttle_delay": 0
                }
                analysis = {
                    "diagnosis": "NONE", "severity": "low", "estimated_time_delta": None,
                    "confidence": None, "advice": "Keep pushing."
                }

            nx = ((row['x'] - min_x) / x_range) * 100 if x_range != 0 else 50
            ny = ((row['y'] - min_y) / y_range) * 100 if y_range != 0 else 50

            spd_t = int(row['speed']) if not pd.isna(row['speed']) else 0
            spd_b = int(row['speed_bmk']) if not pd.isna(row['speed_bmk']) else 0

            all_samples.append({
                "elapsed": float(row['elapsed']),
                "lap_number": int(lap_number),
                "progress": float(prog),
                "target": {
                    "x": float(nx),
                    "y": float(ny),
                    "speed": spd_t,
                    "throttle": int(row['throttle']) if not pd.isna(row['throttle']) else 0,
                    "brake": int(row['brake']) if not pd.isna(row['brake']) else 0,
                    "gear": int(row['n_gear']) if not pd.isna(row['n_gear']) else 0
                },
                "benchmark": {
                    "speed": spd_b,
                    "throttle": int(row['throttle_bmk']) if not pd.isna(row['throttle_bmk']) else 0,
                    "brake": int(row['brake_bmk']) if not pd.isna(row['brake_bmk']) else 0,
                    "gear": int(row['n_gear_bmk']) if not pd.isna(row['n_gear_bmk']) else 0
                },
                "current_corner": {
                    "name": current_corner,
                    "phase": phase
                },
                "comparison": comp,
                "analysis": analysis,
                "race_context": row['race_context']
            })

    # Ensure all samples are strictly ordered by elapsed time
    all_samples.sort(key=lambda x: x['elapsed'])
    all_samples = _apply_communication_gate(all_samples, session_key, target_driver)

    result = {
        "session_key": session_key,
        "target_driver": target_driver,
        "samples": all_samples
    }

    _cache[cache_key] = result
    try:
        with open(cache_file, "w") as f:
            json.dump(result, f)
    except Exception:
        pass
    return result
