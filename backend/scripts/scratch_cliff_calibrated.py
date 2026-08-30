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

def detect_cliff_calibrated(stint_df, compound="HARD"):
    prior_wear = 0.040 if compound == "HARD" else 0.030
    q_w = 0.00005
    q_c = 0.0002
    r_obs = 0.30**2
    
    # State: [wear_rate, cumulative_wear]
    x = np.array([prior_wear, 0.0])
    P = np.array([
        [0.05**2, 0.0],
        [0.0, 0.10**2]
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
        
        # Observation
        y = row['tyre_wear_effect'] + row['residual']
        H = np.array([0.0, 1.0])
        
        # Update
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
        elif interval_width > 0.075:
            conf = "LOW_CONFIDENCE"
        else:
            conf = "HIGH_CONFIDENCE"
            
        results.append({
            'lap_number': row['lap_number'],
            'tyre_age': row['tyre_age'],
            'observed': row['observed'],
            'wear_rate_est': float(x[0]),
            'sigma_w': sigma_w,
            'interval_90': interval_90,
            'interval_width': interval_width,
            'cum_wear_est': float(x[1]),
            'confidence': conf
        })
        
    out_df = pd.DataFrame(results)
    
    # Established baseline wear rate (from steady laps tyre_age 8..25)
    steady_laps = out_df[(out_df['tyre_age'] >= 8) & (out_df['tyre_age'] <= 25)]
    if len(steady_laps) >= 3:
        baseline_wear_rate = float(steady_laps['wear_rate_est'].median())
    else:
        baseline_wear_rate = float(out_df['wear_rate_est'].median())
    
    baseline_wear_rate = max(0.025, baseline_wear_rate)
    
    # Acceleration threshold for cliff onset: rate of change over 3 laps exceeding 2.0x baseline
    cliff_threshold = 2.0 * baseline_wear_rate
    
    wear_rates = out_df['wear_rate_est'].values
    lap_nums = out_df['lap_number'].values
    tyre_ages = out_df['tyre_age'].values
    n = len(out_df)
    
    rolling_derivs = []
    cliff_probs = []
    cliff_onset_lap = None
    consecutive_cliff = 0
    candidate_onset = None
    
    for i in range(n):
        age = tyre_ages[i]
        # Only evaluate cliff after warmup / initial phase (tyre_age >= 15 for mature stint)
        if i < 2 or age < 15:
            deriv = 0.0
            prob = 0.02
        else:
            d_laps = max(1, lap_nums[i] - lap_nums[i-2])
            # Acceleration in wear rate scaled per 10 laps
            deriv = max(0.0, (wear_rates[i] - wear_rates[i-2]) / d_laps * 10.0)
            ratio = deriv / cliff_threshold if cliff_threshold > 0 else 0.0
            prob = float(1.0 / (1.0 + np.exp(- 5.0 * (ratio - 1.0))))
            
        rolling_derivs.append(deriv)
        cliff_probs.append(prob)
        
        if deriv >= cliff_threshold and age >= 20:
            if consecutive_cliff == 0:
                candidate_onset = lap_nums[i-1] if i >= 1 else lap_nums[i]
            consecutive_cliff += 1
            if consecutive_cliff >= 2 and cliff_onset_lap is None:
                cliff_onset_lap = candidate_onset
        else:
            consecutive_cliff = 0
            
    out_df['rolling_deriv'] = rolling_derivs
    out_df['cliff_probability'] = cliff_probs
    
    return out_df, cliff_onset_lap, baseline_wear_rate

for s, grp in df.groupby('stint_number'):
    comp = "HARD" if s == 1 else "MEDIUM"
    out_df, onset_lap, base_wear = detect_cliff_calibrated(grp, compound=comp)
    print(f"\n==================== STINT {s} ({comp}) ====================")
    print(f"Stint Baseline Wear Rate: {base_wear:.4f} s/lap")
    print(f"Detected Cliff Onset Lap: {onset_lap}")
    print(out_df[['lap_number', 'tyre_age', 'wear_rate_est', 'interval_width', 'confidence', 'rolling_deriv', 'cliff_probability']].to_string())
