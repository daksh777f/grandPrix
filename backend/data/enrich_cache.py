import os
import glob
import pandas as pd
import json

print("Loading cache...")
cache_path = r"C:\Users\caagg\Desktop\Coding\grandPrix\backend\data\cache_9165_1.json"
with open(cache_path, "r") as f:
    cache = json.load(f)

# Find first_date
laps_df = pd.read_csv(r"C:\Users\caagg\Desktop\Coding\grandPrix\data\laps.csv")
first_date_str = laps_df[laps_df['driver_number'] == 1].iloc[0]['date_start']
first_date = pd.to_datetime(first_date_str)

# Load other driver locations
print("Loading other drivers...")
driver_locs = {}
# Find global bounds from the target driver to perfectly match live_analysis.py
target_loc = pd.read_csv(r"C:\Users\caagg\Desktop\Coding\grandPrix\data\location_1.csv")
min_x = target_loc['x'].min()
max_x = target_loc['x'].max()
min_y = target_loc['y'].min()
max_y = target_loc['y'].max()
x_range = max_x - min_x if max_x != min_x else 1
y_range = max_y - min_y if max_y != min_y else 1

for f in glob.glob(r"C:\Users\caagg\Desktop\Coding\grandPrix\data\location_*.csv"):
    dr = f.split("location_")[-1].replace(".csv", "")
    if dr == "1":
        continue
    df = pd.read_csv(f)
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.dropna(subset=['date'])
    df = df.sort_values('date').reset_index(drop=True)

    # Downsample to 2Hz to save memory/speed, it's enough for dots
    df = df.set_index('date').resample('500ms').first().dropna(subset=['x','y']).reset_index()

    df['nx'] = ((df['x'] - min_x) / x_range) * 100
    df['ny'] = ((df['y'] - min_y) / y_range) * 100
    df = df.sort_values('date')

    driver_locs[dr] = df

print("Enriching samples...")
# To merge efficiently, we can construct a DataFrame of the sample times
sample_times = [first_date + pd.Timedelta(seconds=s['elapsed']) for s in cache['samples']]
samples_df = pd.DataFrame({'date': sample_times})

for dr, df in driver_locs.items():
    print(f"Merging driver {dr}...")
    merged = pd.merge_asof(samples_df, df[['date', 'nx', 'ny']], on='date', direction='nearest', tolerance=pd.Timedelta(seconds=2))

    for i, row in merged.iterrows():
        if pd.notna(row['nx']):
            if 'others' not in cache['samples'][i]:
                cache['samples'][i]['others'] = {}
            cache['samples'][i]['others'][dr] = {'x': round(row['nx'], 2), 'y': round(row['ny'], 2)}

print("Saving cache...")
with open(cache_path, "w") as f:
    json.dump(cache, f)

print("Done!")
