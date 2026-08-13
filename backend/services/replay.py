import pandas as pd
import os
from fastapi import HTTPException

_cache = {}

def load_data(driver_number: int):
    if driver_number in _cache:
        return _cache[driver_number]

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    laps_path = os.path.join(base_dir, "data", "laps.csv")
    loc_path = os.path.join(base_dir, "data", f"location_{driver_number}.csv")
    car_path = os.path.join(base_dir, "data", f"car_data_{driver_number}.csv")

    if not os.path.exists(laps_path) or not os.path.exists(loc_path) or not os.path.exists(car_path):
        raise HTTPException(status_code=500, detail="Data files not found")

    laps_df = pd.read_csv(laps_path)
    loc_df = pd.read_csv(loc_path)
    car_df = pd.read_csv(car_path)

    laps_df = laps_df[laps_df['driver_number'] == driver_number]

    laps_df['date_start'] = pd.to_datetime(laps_df['date_start'], errors='coerce')
    loc_df['date'] = pd.to_datetime(loc_df['date'], errors='coerce')
    car_df['date'] = pd.to_datetime(car_df['date'], errors='coerce')

    loc_df = loc_df.sort_values('date').dropna(subset=['date'])
    car_df = car_df.sort_values('date').dropna(subset=['date'])

    # Synchronize timestamps: for each location, find nearest telemetry
    merged_df = pd.merge_asof(loc_df, car_df, on='date', direction='nearest')

    _cache[driver_number] = {
        'laps': laps_df,
        'merged': merged_df
    }
    return _cache[driver_number]

def get_replay_data(session_key: int, driver_number: int, lap: int):
    data = load_data(driver_number)
    laps_df = data['laps']
    merged_df = data['merged']

    lap_data = laps_df[laps_df['lap_number'] == lap]
    if lap_data.empty:
        raise HTTPException(status_code=404, detail=f"Lap {lap} not found for driver {driver_number}")

    lap_row = lap_data.iloc[0]
    if pd.isna(lap_row['date_start']):
        raise HTTPException(status_code=500, detail=f"Invalid date_start for lap {lap}")

    start_time = lap_row['date_start']

    next_lap = laps_df[laps_df['lap_number'] == lap + 1]
    if not next_lap.empty and not pd.isna(next_lap.iloc[0]['date_start']):
        end_time = next_lap.iloc[0]['date_start']
    else:
        duration = lap_row.get('lap_duration', 100)
        dur_val = float(duration) if not pd.isna(duration) else 100
        end_time = start_time + pd.Timedelta(seconds=dur_val)

    lap_samples = merged_df[(merged_df['date'] >= start_time) & (merged_df['date'] < end_time)]

    if lap_samples.empty:
        raise HTTPException(status_code=404, detail="No telemetry samples found for this lap")

    # Normalize location coordinates to 0-100 bounding box
    min_x = lap_samples['x'].min()
    max_x = lap_samples['x'].max()
    min_y = lap_samples['y'].min()
    max_y = lap_samples['y'].max()

    x_range = max_x - min_x if max_x != min_x else 1
    y_range = max_y - min_y if max_y != min_y else 1

    samples = []
    for _, row in lap_samples.iterrows():
        nx = ((row['x'] - min_x) / x_range) * 100
        ny = ((row['y'] - min_y) / y_range) * 100

        samples.append({
            "elapsed": (row['date'] - start_time).total_seconds(),
            "x": nx,
            "y": ny,
            "speed": int(row['speed']) if not pd.isna(row['speed']) else 0,
            "throttle": int(row['throttle']) if not pd.isna(row['throttle']) else 0,
            "brake": int(row['brake']) if not pd.isna(row['brake']) else 0,
            "gear": int(row['n_gear']) if not pd.isna(row['n_gear']) else 0,
            "rpm": int(row['rpm']) if not pd.isna(row['rpm']) else 0,
            "drs": int(row['drs']) if not pd.isna(row['drs']) else 0
        })

    return {
        "session_key": session_key,
        "driver_number": driver_number,
        "lap_number": lap,
        "lap_duration": float(lap_row.get('lap_duration', 0)) if not pd.isna(lap_row.get('lap_duration')) else 0,
        "samples": samples
    }
