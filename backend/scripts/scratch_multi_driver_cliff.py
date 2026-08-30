import sys
import os
sys.path.insert(0, os.path.abspath('backend'))
import pandas as pd
import numpy as np

from services.tyre_decomposition import CausalTyreDecomposer

decomposer = CausalTyreDecomposer()
session_key = 9165

# Test Kalman + Cliff Detector on Driver 1 and Driver 16
for d in [1, 16, 63]:
    recs = decomposer.decompose_session(session_key, d)
    df_d = pd.DataFrame([r.to_dict() for r in recs])
    print(f"\n==================== DRIVER {d} ====================")
    for s_num, s_grp in df_d.groupby('stint_number'):
        from scratch_cliff_calibrated import detect_cliff_calibrated
        out_df, onset_lap, base_wear = detect_cliff_calibrated(s_grp)
        print(f"Stint {s_num} (n={len(s_grp)}): Base Wear = {base_wear:.4f}s, Cliff Onset = {onset_lap}")
        if onset_lap is not None:
            cliff_row = out_df[out_df['lap_number'] == onset_lap]
            print(f"  -> Cliff detected at lap {onset_lap}: {cliff_row[['lap_number', 'tyre_age', 'wear_rate_est', 'cliff_probability']].to_dict(orient='records')}")
