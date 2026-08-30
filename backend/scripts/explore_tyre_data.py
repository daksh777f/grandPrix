import os
import pandas as pd
import numpy as np

def test_data():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    laps_df = pd.read_csv(os.path.join(base_dir, "data", "laps.csv"))
    rc_df = pd.read_csv(os.path.join(base_dir, "data", "race_control.csv"))
    int_df = pd.read_csv(os.path.join(base_dir, "data", "intervals.csv"))

    v_laps = laps_df[(laps_df['session_key'] == 9165) & (laps_df['driver_number'] == 1)].sort_values('lap_number')
    print("Driver 1 total laps:", len(v_laps))
    print(v_laps[['lap_number', 'lap_duration', 'is_pit_out_lap', 'date_start']].head(30))
    print(v_laps[['lap_number', 'lap_duration', 'is_pit_out_lap', 'date_start']].tail(35))

if __name__ == '__main__':
    test_data()
