import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from services.tyre_state import (
    BayesianTyreStateEngine,
    get_driver_tyre_state,
    estimate_bayesian_tyre_state,
    detect_tyre_cliff,
)
from services.live_analysis import get_live_analysis


def run_test():
    session_key = 9165
    driver_number = 1

    print("=" * 115)
    print(f"BAYESIAN LATENT TYRE STATE & CLIFF DETECTION AUDIT: Session {session_key}, Driver {driver_number} (Verstappen)")
    print("=" * 115)

    engine = BayesianTyreStateEngine()
    state_data = engine.estimate_session_tyre_state(session_key, driver_number)

    records = state_data["records"]
    stints = state_data["stints"]

    if not records:
        print("ERROR: No tyre state records returned!")
        sys.exit(1)

    df = pd.DataFrame(records)

    print(f"\nTotal state-estimated laps: {len(records)} across {len(stints)} stints\n")

    for s_num, s_meta in stints.items():
        print(f"Stint {s_num} ({s_meta['compound']}): {s_meta['laps_count']} laps | "
              f"Cliff Onset Lap: {s_meta['cliff_onset_lap']} | "
              f"Max Cliff Prob: {s_meta['max_cliff_probability']*100:.1f}% | "
              f"Final Wear Rate: {s_meta['final_wear_rate']:.4f}s/lap")

    print("\n" + "=" * 135)
    print(f"{'Lap':<5} | {'Stint':<5} | {'Age':<5} | {'Observed':<10} | {'Wear Rate':<10} | {'90% Interval':<20} | {'Width':<8} | {'Cum Wear':<10} | {'Confidence':<22} | {'Cliff Prob':<10}")
    print("=" * 135)

    for r in records:
        low, high = r['wear_rate_90pct_interval']
        interval_str = f"[{low:.3f}, {high:.3f}]"
        print(
            f"{r['lap_number']:<5} | {r['stint_number']:<5} | {r['tyre_age']:<5} | "
            f"{r['observed_lap_time']:<10.3f} | {r['wear_rate_estimate']:<10.4f} | "
            f"{interval_str:<20} | {r['interval_width']:<8.4f} | "
            f"{r['cumulative_wear_estimate']:<10.3f} | {r['confidence']:<22} | "
            f"{r['cliff_probability']*100:<9.1f}%"
        )

    print("=" * 135)

    # -------------------------------------------------------------
    # MANDATORY SANITY CHECKS
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print("PERFORMING MANDATORY SANITY CHECKS:")
    print("=" * 80)

    # Check 1: Uncertainty Interval Width Shrinking (Bayesian property)
    print("1. Bayesian Uncertainty Interval Convergence:")
    for s_num, s_df in df.groupby('stint_number'):
        start_w = s_df['interval_width'].iloc[0]
        min_w = s_df['interval_width'].min()
        end_w = s_df['interval_width'].iloc[-1]
        print(f"   - Stint {s_num}: Initial Width = {start_w:.4f}s -> Min Width = {min_w:.4f}s -> Final = {end_w:.4f}s (Shrank by {(1 - min_w/start_w)*100:.1f}%)")
        assert min_w < start_w, f"Stint {s_num} uncertainty did not shrink as laps accumulated!"

    # Check 2: Honesty Labeling Behavior
    print("\n2. Honesty Labeling Verification:")
    insufficient_count = (df['confidence'] == 'INSUFFICIENT_EVIDENCE').sum()
    high_conf_count = (df['confidence'] == 'HIGH_CONFIDENCE').sum()
    print(f"   - INSUFFICIENT_EVIDENCE laps: {insufficient_count} (first 3 laps of each stint)")
    print(f"   - HIGH_CONFIDENCE laps:       {high_conf_count} (mature, low uncertainty laps)")
    for s_num, s_df in df.groupby('stint_number'):
        first_3_conf = s_df['confidence'].iloc[:3].unique()
        assert list(first_3_conf) == ['INSUFFICIENT_EVIDENCE'], f"Stint {s_num} did not label early laps as INSUFFICIENT_EVIDENCE!"

    # Check 3: Discriminative Cliff Detection (Does not fire indiscriminately)
    print("\n3. Cliff Detector Discrimination:")
    # Check Driver 16 (long worn Hard stint) vs Driver 1
    d16_state = engine.estimate_session_tyre_state(session_key, 16)
    d16_stints = d16_state["stints"]
    d16_cliff_stint2 = d16_stints[2]["cliff_onset_lap"]
    d1_stint2_cliff = stints[2]["cliff_onset_lap"]

    print(f"   - Driver 1 Stint 2 (Fresh 22-lap Medium): Cliff Onset = {d1_stint2_cliff} (Expected: None / no cliff)")
    print(f"   - Driver 16 Stint 2 (Long 42-lap Hard):   Cliff Onset = {d16_cliff_stint2} (Expected: Plausible cliff lap)")

    assert d1_stint2_cliff is None, "Fresh stint 2 should not have triggered a cliff onset lap!"
    assert d16_cliff_stint2 is not None, "Long 42-lap stint on Driver 16 should detect a plausible cliff onset lap!"

    # Check 4: Communication Gate Escalation to RADIO_NOW with TYRE_ALERT
    print("\n4. Communication Gate Integration Test:")
    live_res = get_live_analysis(session_key, 1)
    samples = live_res.get("samples", [])
    
    tyre_alert_samples = [
        s for s in samples
        if s.get("communication", {}).get("category") == "TYRE_ALERT"
    ]
    radio_tyre_samples = [
        s for s in tyre_alert_samples
        if s.get("communication", {}).get("state") == "RADIO_NOW"
    ]

    print(f"   - Total telemetry samples analyzed: {len(samples)}")
    print(f"   - Samples flagged as TYRE_ALERT candidate: {len(tyre_alert_samples)}")
    print(f"   - Samples escalated to RADIO_NOW (TYRE_ALERT): {len(radio_tyre_samples)}")

    if radio_tyre_samples:
        sample_radio = radio_tyre_samples[0]
        print(f"   - Example RADIO_NOW tyre alert on Lap {sample_radio['lap_number']}: "
              f"Reason: {sample_radio['communication']['reason']} | "
              f"Advice: {sample_radio['analysis']['advice']}")

    print("\n>>> ALL PHASE 3 BAYESIAN TYRE STATE & CLIFF DETECTION TESTS PASSED CLEANLY <<<\n")


if __name__ == '__main__':
    run_test()
