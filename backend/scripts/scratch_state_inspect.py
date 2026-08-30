import sys
import os
sys.path.insert(0, os.path.abspath('backend'))
import pandas as pd
import numpy as np

from services.tyre_decomposition import CausalTyreDecomposer

decomposer = CausalTyreDecomposer()
session_key = 9165
driver_number = 1

records = decomposer.decompose_session(session_key, driver_number)
print(f"Total representative records: {len(records)}")

df = pd.DataFrame([r.to_dict() for r in records])
for s, grp in df.groupby('stint_number'):
    print(f"\n--- Stint {s} (n={len(grp)}) ---")
    print(grp[['lap_number', 'tyre_age', 'observed', 'tyre_wear_effect', 'residual']].to_string())
