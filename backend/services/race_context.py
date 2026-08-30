import pandas as pd
import numpy as np
import os
import time

_cache = {}
_context_timeline_cache = {}

BATTLE_GAP_THRESHOLD = 0.25
MAX_INTERVAL_AGE_SECONDS = 15.0
BATTLE_MIN_VALID_OBSERVATIONS = 2

def get_base_dir():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_csv(filename):
    if filename in _cache:
        return _cache[filename]
    path = os.path.join(get_base_dir(), "data", filename)
    if not os.path.exists(path):
        return None
    df = pd.read_csv(path)
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.sort_values('date').dropna(subset=['date'])
    _cache[filename] = df
    return df

def _build_context_timeline(session_key: int, target_driver: int):
    cache_key = (session_key, target_driver)
    if cache_key in _context_timeline_cache:
        return _context_timeline_cache[cache_key]

    pos_df = load_csv("position.csv")
    int_df = load_csv("intervals.csv")

    if pos_df is None or int_df is None:
        return np.array([]), []

    pos_df = pos_df[pos_df['session_key'] == session_key].sort_values('date').reset_index(drop=True)
    int_df = int_df[int_df['session_key'] == session_key].sort_values('date').reset_index(drop=True)

    target_pos_df = pos_df[pos_df['driver_number'] == target_driver].sort_values('date').reset_index(drop=True)

    # Pre-index intervals by driver
    intervals_by_driver = {}
    for d_num, group in int_df.groupby('driver_number'):
        valid_grp = group.dropna(subset=['interval']).sort_values('date').reset_index(drop=True)
        intervals_by_driver[int(d_num)] = {
            "dates": valid_grp['date'].to_numpy(),
            "intervals": pd.to_numeric(valid_grp['interval'], errors='coerce').to_numpy()
        }

    # All unique event dates in pos_df
    event_dates = pos_df['date'].to_numpy()
    
    # Track field positions over time
    current_positions = {}
    target_pos_history = []
    
    timeline_records = []
    
    target_dates = target_pos_df['date'].to_numpy()
    target_positions_arr = target_pos_df['position'].astype(int).to_numpy()

    for row in pos_df.itertuples():
        d_num = int(row.driver_number)
        p_val = int(row.position)
        current_positions[d_num] = p_val
        ts = row.date

        # Target position at ts
        t_idx = np.searchsorted(target_dates, ts, side='right') - 1
        if t_idx < 0:
            timeline_records.append({
                "position": None,
                "driver_behind": None,
                "gap_behind": None,
                "battle_active": False,
                "is_defending": False,
                "position_event": "NO_CHANGE"
            })
            continue

        cur_pos = target_positions_arr[t_idx]
        
        # Check position event
        pos_event = "NO_CHANGE"
        if t_idx >= 1:
            prev_pos = target_positions_arr[t_idx - 1]
            diff = prev_pos - cur_pos
            time_since_change = (ts - target_dates[t_idx]).total_seconds()
            if time_since_change <= 30.0:
                if diff == 1:
                    pos_event = "POSITION_GAIN"
                elif diff > 1:
                    pos_event = "MULTI_POSITION_GAIN"
                elif diff == -1:
                    pos_event = "POSITION_LOSS"
                elif diff < -1:
                    pos_event = "MULTI_POSITION_LOSS"

        # Driver behind
        driver_behind = None
        for d, p in current_positions.items():
            if p == cur_pos + 1 and d != target_driver:
                driver_behind = d
                break

        gap_behind = None
        battle_active = False
        is_defending = False

        if driver_behind is not None and driver_behind in intervals_by_driver:
            db_data = intervals_by_driver[driver_behind]
            int_dates = db_data["dates"]
            int_vals = db_data["intervals"]

            i_idx = np.searchsorted(int_dates, ts, side='right') - 1
            if i_idx >= 0:
                age = (ts - pd.Timestamp(int_dates[i_idx])).total_seconds()
                if age <= MAX_INTERVAL_AGE_SECONDS and not np.isnan(int_vals[i_idx]):
                    gap = float(int_vals[i_idx])
                    gap_behind = round(gap, 3)

                    # Check last N observations
                    start_i = max(0, i_idx - BATTLE_MIN_VALID_OBSERVATIONS + 1)
                    last_n = int_vals[start_i:i_idx + 1]
                    if len(last_n) >= BATTLE_MIN_VALID_OBSERVATIONS:
                        if np.all(last_n < BATTLE_GAP_THRESHOLD):
                            battle_active = True
                            is_defending = True

        timeline_records.append({
            "position": cur_pos,
            "driver_behind": driver_behind,
            "gap_behind": gap_behind,
            "battle_active": battle_active,
            "is_defending": is_defending,
            "position_event": pos_event
        })

    result = (event_dates, timeline_records, target_dates, target_positions_arr)
    _context_timeline_cache[cache_key] = result
    return result

def get_race_context(session_key: int, target_driver: int, timestamps: pd.Series) -> list:
    """
    Fast, precomputed race context evaluation using binary search.
    """
    event_dates, timeline_records, target_dates, target_positions_arr = _build_context_timeline(session_key, target_driver)
    if len(event_dates) == 0:
        return [None] * len(timestamps)

    ts_arr = timestamps.to_numpy()
    indices = np.searchsorted(event_dates, ts_arr, side='right') - 1

    contexts = []
    num_events = len(timeline_records)

    for i, ts in zip(indices, timestamps):
        if i < 0:
            contexts.append({
                "position": None,
                "driver_behind": None,
                "gap_behind": None,
                "battle_active": False,
                "is_defending": False,
                "position_event": "NO_CHANGE"
            })
        elif i < num_events:
            rec = timeline_records[i]
            # Verify if position event expired relative to query timestamp ts
            t_idx = np.searchsorted(target_dates, ts, side='right') - 1
            rec_copy = rec.copy()
            if t_idx >= 1:
                time_since_change = (ts - target_dates[t_idx]).total_seconds()
                if time_since_change > 30.0:
                    rec_copy["position_event"] = "NO_CHANGE"
            contexts.append(rec_copy)
        else:
            contexts.append(timeline_records[-1].copy())

    return contexts
