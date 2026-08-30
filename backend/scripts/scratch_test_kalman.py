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
df = pd.DataFrame([r.to_dict() for r in records])

# Test Kalman filter per stint
def run_kalman_on_stint(stint_df, prior_wear_rate=0.05, prior_sigma_w=0.06):
    q_w = 0.0001
    q_c = 0.0005
    r_obs = 0.38**2
    
    # State: [wear_rate, cumulative_wear]
    x = np.array([prior_wear_rate, 0.0])
    P = np.array([
        [prior_sigma_w**2, 0.0],
        [0.0, 0.20**2]
    ])
    
    results = []
    prev_age = 1
    
    for i, row in stint_df.reset_index(drop=True).iterrows():
        age = row['tyre_age']
        delta_age = max(1, age - prev_age)
        prev_age = age
        
        # Predict
        F = np.array([
            [1.0, 0.0],
            [float(delta_age), 1.0]
        ])
        Q = np.array([
            [q_w * delta_age, 0.0],
            [0.0, q_c * delta_age]
        ])
        
        x_pred = F @ x
        P_pred = F @ P @ F.T + Q
        
        # Observe: y = observed - base_pace - fuel_effect - track_evolution_effect
        # which equals tyre_wear_effect + residual
        y = row['tyre_wear_effect'] + row['residual']
        H = np.array([0.0, 1.0])
        
        # Measurement update
        S = H @ P_pred @ H.T + r_obs
        K = P_pred @ H.T / S
        y_innov = y - H @ x_pred
        
        x = x_pred + K * y_innov
        P = (np.eye(2) - np.outer(K, H)) @ P_pred
        
        sigma_w = float(np.sqrt(max(1e-6, P[0, 0])))
        interval_90 = (float(x[0] - 1.645 * sigma_w), float(x[0] + 1.645 * sigma_w))
        interval_width = interval_90[1] - interval_90[0]
        
        laps_so_far = i + 1
        if laps_so_far < 4:
            conf = "INSUFFICIENT_EVIDENCE"
        elif interval_width > 0.05:
            conf = "LOW_CONFIDENCE"
        else:
            conf = "HIGH_CONFIDENCE"
            
        results.append({
            'lap_number': row['lap_number'],
            'tyre_age': row['tyre_age'],
            'observed': row['observed'],
            'y_noisy_wear': y,
            'wear_rate_est': float(x[0]),
            'sigma_w': sigma_w,
            'interval_90_low': interval_90[0],
            'interval_90_high': interval_90[1],
            'interval_width': interval_width,
            'cum_wear_est': float(x[1]),
            'confidence': conf
        })
        
    return pd.DataFrame(results)

for s, grp in df.groupby('stint_number'):
    print(f"\n==================== STINT {s} ====================")
    res_df = run_kalman_on_stint(grp)
    print(res_df[['lap_number', 'tyre_age', 'wear_rate_est', 'interval_width', 'confidence', 'cum_wear_est']].to_string())
