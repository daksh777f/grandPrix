import pandas as pd
import numpy as np
import os

_cache = {}

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

def get_race_context(session_key: int, target_driver: int, timestamps: pd.Series) -> list:
    """
    Given a series of timestamps (from telemetry), compute the race context at each timestamp.
    """
    pos_df = load_csv("position.csv")
    int_df = load_csv("intervals.csv")

    if pos_df is None or int_df is None:
        # Fallback if files missing
        return [None] * len(timestamps)

    pos_df = pos_df[pos_df['session_key'] == session_key]
    int_df = int_df[int_df['session_key'] == session_key]

    contexts = []
    target_pos_history = pos_df[pos_df['driver_number'] == target_driver]

    for ts in timestamps:
        ctx = {
            "position": None,
            "driver_behind": None,
            "gap_behind": None,
            "battle_active": False,
            "is_defending": False,
            "position_event": "NO_CHANGE"
        }

        # Find target position at ts
        t_pos_records = target_pos_history[target_pos_history['date'] <= ts]
        if t_pos_records.empty:
            contexts.append(ctx)
            continue

        current_pos = int(t_pos_records.iloc[-1]['position'])
        ctx["position"] = current_pos

        # Check position event (if changed within the last lap roughly)
        # To avoid NO_CHANGE triggering every sample, we track state,
        # but the request asks to output "POSITION_GAIN" if the position changed.
        # Let's compare the most recent position to the one before it.
        # But if the position changed 10 minutes ago, is it still a recent event?
        # A simple approach: we check if the most recent position record happened recently.
        # For simplicity, we just use the most recent transition. But LLM will be called per corner,
        # so if the LLM receives "POSITION_GAIN" for every corner after a gain, that's fine. It'll adapt.
        if len(t_pos_records) >= 2:
            prev_pos = int(t_pos_records.iloc[-2]['position'])
            diff = prev_pos - current_pos # e.g. 5 to 4 means +1 (gain)

            # Only flag as an event if it happened recently (within 30 seconds)
            time_since_change = (ts - t_pos_records.iloc[-1]['date']).total_seconds()
            if time_since_change <= 30.0:
                if diff == 1:
                    ctx["position_event"] = "POSITION_GAIN"
                elif diff > 1:
                    ctx["position_event"] = "MULTI_POSITION_GAIN"
                elif diff == -1:
                    ctx["position_event"] = "POSITION_LOSS"
                elif diff < -1:
                    ctx["position_event"] = "MULTI_POSITION_LOSS"

        # Find driver behind
        field_pos = pos_df[pos_df['date'] <= ts]
        if not field_pos.empty:
            latest_field_pos = field_pos.groupby('driver_number').last().reset_index()
            driver_behind_row = latest_field_pos[latest_field_pos['position'] == current_pos + 1]
            if not driver_behind_row.empty:
                driver_behind = int(driver_behind_row.iloc[0]['driver_number'])
                ctx["driver_behind"] = driver_behind

                db_intervals = int_df[(int_df['driver_number'] == driver_behind) & (int_df['date'] <= ts)]

                if not db_intervals.empty:
                    valid_db_intervals = db_intervals.dropna(subset=['interval'])

                    if not valid_db_intervals.empty:
                        latest_interval = valid_db_intervals.iloc[-1]
                        age = (ts - latest_interval['date']).total_seconds()

                        if age <= MAX_INTERVAL_AGE_SECONDS:
                            try:
                                gap = float(latest_interval['interval'])
                                ctx["gap_behind"] = round(gap, 3)

                                last_n = valid_db_intervals.tail(BATTLE_MIN_VALID_OBSERVATIONS)
                                if len(last_n) >= BATTLE_MIN_VALID_OBSERVATIONS:
                                    all_close = all(float(r['interval']) < BATTLE_GAP_THRESHOLD for _, r in last_n.iterrows())
                                    if all_close:
                                        ctx["battle_active"] = True
                                        ctx["is_defending"] = True
                            except ValueError:
                                pass # In case interval is not parseable

        contexts.append(ctx)

    return contexts
