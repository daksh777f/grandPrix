import sys
import os
sys.path.insert(0, os.path.abspath('backend'))
import pandas as pd
import numpy as np

from services.tyre_decomposition import CausalTyreDecomposer

decomposer = CausalTyreDecomposer()
session_key = 9165

# Check multiple drivers: 1 (Verstappen), 44 (Hamilton), 55 (Sainz), 63 (Russell), 16 (Leclerc)
test_drivers = [1, 16, 44, 55, 63]

for d in test_drivers:
    recs = decomposer.decompose_session(session_key, d)
    df_d = pd.DataFrame([r.to_dict() for r in recs])
    print(f"\nDriver {d}: {len(df_d)} representative laps across {df_d['stint_number'].nunique()} stints")
    for s_num, s_grp in df_d.groupby('stint_number'):
        print(f"  Stint {s_num}: {len(s_grp)} reps, tyre age {s_grp['tyre_age'].min()}..{s_grp['tyre_age'].max()}")
