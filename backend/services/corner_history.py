import json
import os

def get_base_dir():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_corner_history(session_key: int, driver_number: int, corner: str):
    cache_path = os.path.join(get_base_dir(), "data", f"cache_{session_key}_{driver_number}.json")
    if not os.path.exists(cache_path):
        return {"error": "Cache not found"}

    try:
        with open(cache_path, "r") as f:
            data = json.load(f)
    except Exception as e:
        return {"error": f"Failed to load cache: {str(e)}"}

    samples = data.get("samples", [])
    if not samples:
        return {"error": "No samples found"}

    # Group samples by lap
    lap_samples = {}
    for s in samples:
        lap = s.get("lap_number")
        if not lap:
            continue
        if s.get("current_corner", {}).get("name") == corner:
            if lap not in lap_samples:
                lap_samples[lap] = []
            lap_samples[lap].append(s)

    laps = []
    for lap, s_list in sorted(lap_samples.items()):
        if len(s_list) < 5:
            continue # Insufficient data

        entry_speed = s_list[0]["target"]["speed"]
        exit_speed = s_list[-1]["target"]["speed"]
        minimum_speed = min(s["target"]["speed"] for s in s_list)
        
        # Find brake progress
        brake_progress = None
        for s in s_list:
            if s["target"]["brake"] > 0:
                brake_progress = s["progress"]
                break
                
        diagnosis = s_list[0].get("analysis", {}).get("diagnosis", "None")
        estimated_time_delta = s_list[0].get("analysis", {}).get("estimated_time_delta", 0.0)

        # Skip lap if incomplete or weird
        if entry_speed == 0 and exit_speed == 0:
            continue

        laps.append({
            "lap": lap,
            "entry_speed": round(entry_speed),
            "brake_progress": brake_progress,
            "minimum_speed": round(minimum_speed),
            "exit_speed": round(exit_speed),
            "estimated_time_delta": estimated_time_delta,
            "diagnosis": diagnosis
        })

    # Calculate trends using 3-v-3 comparison
    trends = {
        "entry_speed": None,
        "minimum_speed": None,
        "exit_speed": None,
        "time_loss": None
    }
    summary_text = None
    if len(laps) >= 6:
        # We should use all laps that made it through the len(s_list) >= 5 check.
        recent = laps[-3:]
        previous = laps[-6:-3]

        def get_avg(lst, key):
            vals = [l[key] for l in lst if l[key] is not None]
            return sum(vals) / len(vals) if vals else 0

        r_entry = get_avg(recent, "entry_speed")
        p_entry = get_avg(previous, "entry_speed")
        trends["entry_speed"] = "IMPROVING" if r_entry > p_entry + 1 else ("DEGRADING" if r_entry < p_entry - 1 else "STABLE")

        r_min = get_avg(recent, "minimum_speed")
        p_min = get_avg(previous, "minimum_speed")
        trends["minimum_speed"] = "IMPROVING" if r_min > p_min + 1 else ("DEGRADING" if r_min < p_min - 1 else "STABLE")

        r_exit = get_avg(recent, "exit_speed")
        p_exit = get_avg(previous, "exit_speed")
        trends["exit_speed"] = "IMPROVING" if r_exit > p_exit + 1 else ("DEGRADING" if r_exit < p_exit - 1 else "STABLE")

        r_loss = get_avg(recent, "estimated_time_delta")
        p_loss = get_avg(previous, "estimated_time_delta")
        trends["time_loss"] = "IMPROVING" if r_loss < p_loss - 0.05 else ("DEGRADING" if r_loss > p_loss + 0.05 else "STABLE")

        if trends["time_loss"] == "IMPROVING":
            diff = abs(p_loss - r_loss)
            summary_text = f"Time loss has improved by {diff:.2f}s over the previous 3-lap window."
        elif trends["time_loss"] == "DEGRADING":
            diff = abs(p_loss - r_loss)
            summary_text = f"Time loss has degraded by {diff:.2f}s over the previous 3-lap window."
        elif trends["entry_speed"] == "IMPROVING":
            diff = abs(r_entry - p_entry)
            summary_text = f"Entry speed is up {diff:.0f} km/h over the recent 3-lap average."
        elif trends["entry_speed"] == "DEGRADING":
            diff = abs(r_entry - p_entry)
            summary_text = f"Entry speed is down {diff:.0f} km/h over the recent 3-lap average."
        else:
            summary_text = "Performance has remained stable over the last 6 laps."

    return {
        "session_key": session_key,
        "driver_number": driver_number,
        "corner": corner,
        "trend": trends,
        "summary": summary_text,
        "laps": laps
    }
