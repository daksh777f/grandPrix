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

# Let's test the state estimation and cliff detector together
def analyze_stint_state_and_cliff(stint_df, compound="HARD"):
    prior_wear = 0.040 if compound == "HARD" else 0.050
    q_w = 0.00005
    q_c = 0.0002
    r_obs = 0.25**2
    
    # State: [wear_rate, cumulative_wear]
    x = np.array([prior_wear, 0.0])
    P = np.array([
        [0.05**2, 0.0],
        [0.0, 0.10**2]
    ])
    
    records_out = []
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
            
        records_out.append({
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
        
    out_df = pd.DataFrame(records_out)
    
    # Baseline wear rate for the stint (e.g. median wear rate of early confident laps or overall early stint)
    early_laps = out_df.iloc[:min(10, len(out_df))]
    baseline_wear_rate = max(0.020, float(early_laps['wear_rate_est'].median()))
    
    # Rolling rate-of-change of wear_rate_estimate over a 3-lap window:
    # d(wear_rate) / d(lap)
    wear_rates = out_df['wear_rate_est'].values
    lap_nums = out_df['lap_number'].values
    n = len(out_df)
    
    rolling_derivs = []
    cliff_probs = []
    
    cliff_threshold = 1.8 * baseline_wear_rate  # threshold for acceleration
    cliff_onset_lap = None
    consecutive_cliff_count = 0
    first_candidate_lap = None
    
    for i in range(n):
        if i < 2:
            deriv = 0.0
        else:
            # 3-lap window slope: (wear_rate[i] - wear_rate[i-2]) / (lap_num[i] - lap_num[i-2])
            d_laps = max(1, lap_nums[i] - lap_nums[i-2])
            deriv = max(0.0, (wear_rates[i] - wear_rates[i-2]) / d_laps * 10.0) # scaled per 10 laps or rate
        
        rolling_derivs.append(deriv)
        
        # Smooth cliff probability using sigmoid around threshold
        # prob = 1 / (1 + exp(-k * (ratio - 1)))
        ratio = deriv / cliff_threshold if cliff_threshold > 0 else 0.0
        prob = float(1.0 / (1.0 + np.exp(- 4.0 * (ratio - 1.0))))
        if out_df.iloc[i]['confidence'] == "INSUFFICIENT_EVIDENCE":
            prob = min(prob, 0.15) # Suppress cliff probability during early warmup
        cliff_probs.append(prob)
        
        # Check consecutive laps exceeding threshold
        if deriv >= cliff_threshold:
            if consecutive_cliff_count == 0:
                first_candidate_lap = lap_nums[i-2] if i >= 2 else lap_nums[i]
            consecutive_cliff_count += 1
            if consecutive_cliff_count >= 2 and cliff_onset_lap is None:
                cliff_onset_lap = first_candidate_lap
        else:
            consecutive_cliff_count = 0
            
    out_df['rolling_deriv'] = rolling_derivs
    out_df['cliff_probability'] = cliff_probs
    
    return out_df, cliff_onset_lap, baseline_wear_rate

for s, grp in df.groupby('stint_number'):
    comp = "HARD" if s == 1 else "MEDIUM"
    out_df, onset_lap, base_wear = analyze_stint_state_and_cliff(grp, compound=comp)
    print(f"\n==================== STINT {s} ({comp}) ====================")
    print(f"Stint Baseline Wear Rate: {base_wear:.4f} s/lap")
    print(f"Detected Cliff Onset Lap: {onset_lap}")
    print(out_df[['lap_number', 'tyre_age', 'wear_rate_est', 'interval_width', 'confidence', 'rolling_deriv', 'cliff_probability']].to_string())
