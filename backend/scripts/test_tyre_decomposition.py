import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
from services.tyre_decomposition import (
    CausalTyreDecomposer,
    decompose_driver_session,
    decompose_stint_pace,
    counterfactual_lap
)


def run_test():
    session_key = 9165
    driver_number = 1

    print("=" * 110)
    print(f"CAUSAL TYRE DECOMPOSITION AUDIT: Session {session_key}, Driver {driver_number} (Verstappen)")
    print("=" * 110)

    decomposer = CausalTyreDecomposer()
    e_max, decay_rate = decomposer.fit_session_track_evolution(session_key)
    print(f"Session-wide Track Evolution Fit: E_max = {e_max:.4f}s, decay_rate = {decay_rate:.4f}/lap")

    records = decomposer.decompose_session(session_key, driver_number)

    if not records:
        print("ERROR: No decomposed records returned!")
        sys.exit(1)

    df = pd.DataFrame([r.to_dict() for r in records])

    print(f"\nTotal representative laps decomposed: {len(records)}")
    print("\n" + "=" * 125)
    print(f"{'Lap':<5} | {'Stint':<5} | {'Age':<5} | {'Observed':<10} | {'Base Pace':<10} | {'Fuel Eff':<10} | {'Track Evo':<10} | {'Tyre Wear':<10} | {'Residual':<10} | {'CF Prev Lap':<12}")
    print("=" * 125)

    for r in records:
        print(
            f"{r.lap_number:<5} | {r.stint_number:<5} | {r.tyre_age:<5} | "
            f"{r.observed:<10.3f} | {r.base_pace:<10.3f} | {r.fuel_effect:<10.3f} | "
            f"{r.track_evolution_effect:<10.3f} | {r.tyre_wear_effect:<10.3f} | "
            f"{r.residual:<10.3f} | {r.counterfactual_prev_lap_tyre:<12.3f}"
        )

    print("=" * 125)

    # -------------------------------------------------------------
    # SANITY CHECKS (Mandatory Verification)
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print("PERFORMING MANDATORY SANITY CHECKS:")
    print("=" * 80)

    # Check 1: Fuel effect monotonicity
    fuel_diffs = df['fuel_effect'].diff().dropna()
    is_fuel_monotonic = bool((fuel_diffs <= 0).all())
    fuel_start = df['fuel_effect'].iloc[0]
    fuel_end = df['fuel_effect'].iloc[-1]
    print(f"1. Fuel Effect Monotonicity: {'PASSED' if is_fuel_monotonic else 'FAILED'}")
    print(f"   - Lap {df['lap_number'].iloc[0]} fuel effect: {fuel_start:.3f}s -> Lap {df['lap_number'].iloc[-1]} fuel effect: {fuel_end:.3f}s")
    assert is_fuel_monotonic, "Fuel effect is not shrinking monotonically across race!"

    # Check 2: Track evolution magnitude and shape
    te_min = df['track_evolution_effect'].min()
    te_max = df['track_evolution_effect'].max()
    is_te_reasonable = bool(abs(te_min) < 1.0 and te_max <= 0.0)
    print(f"2. Track Evolution Range & Magnitude: {'PASSED' if is_te_reasonable else 'FAILED'}")
    print(f"   - Track evolution range: [{te_min:.4f}s, {te_max:.4f}s] (smooth asymptotic grip evolution)")
    assert is_te_reasonable, f"Track evolution magnitude out of expected bounds: [{te_min}, {te_max}]"

    # Check 3: Stint-by-stint Tyre Wear Trend
    print("3. Stint-by-Stint Tyre Wear Progression:")
    for s_num, s_df in df.groupby('stint_number'):
        corr = float(s_df['tyre_wear_effect'].corr(s_df['tyre_age']))
        wear_min = s_df['tyre_wear_effect'].iloc[0]
        wear_max = s_df['tyre_wear_effect'].iloc[-1]
        print(f"   - Stint {s_num}: {len(s_df)} reps | Age {s_df['tyre_age'].iloc[0]} to {s_df['tyre_age'].iloc[-1]} | Wear: {wear_min:.3f}s -> {wear_max:.3f}s | Corr(wear, age) = {corr:.4f}")
        assert corr >= 0.99, f"Stint {s_num} tyre wear not trending positively with tyre age!"

    # Check 4: Residuals centered near zero with no trend
    mean_res = float(df['residual'].mean())
    std_res = float(df['residual'].std())
    median_res = float(df['residual'].median())
    res_lap_corr = float(df['residual'].corr(df['lap_number']))
    print("4. Residual Distribution & Trend Diagnostics:")
    print(f"   - Mean residual: {mean_res:.6f}s (target: ~0.0s)")
    print(f"   - Std residual:  {std_res:.4f}s")
    print(f"   - Median resid:  {median_res:.4f}s")
    print(f"   - Correlation with lap_number: {res_lap_corr:.6f} (target: ~0.0)")
    assert abs(mean_res) < 1e-4, f"Residuals mean ({mean_res}) is not centered near zero!"
    assert abs(res_lap_corr) < 0.05, f"Residuals show correlation with lap number ({res_lap_corr})!"

    # Check 5: Counterfactual Lap Calculations
    print("\n" + "=" * 80)
    print("COUNTERFACTUAL LAP TEST SAMPLES:")
    print("=" * 80)
    test_laps = [10, 25, 50, 60]
    for l_num in test_laps:
        rec = next((r for r in records if r.lap_number == l_num), None)
        if rec:
            cf_1lap = counterfactual_lap(session_key, driver_number, l_num, rec.tyre_age - 1)
            cf_fresh = counterfactual_lap(session_key, driver_number, l_num, 1)
            print(f"Lap {l_num:2d} (Stint {rec.stint_number}, Age {rec.tyre_age:2d}): Observed = {rec.observed:.3f}s | On (Age - 1) = {cf_1lap:.3f}s (Delta: {cf_1lap - rec.observed:+.3f}s) | On Fresh (Age 1) = {cf_fresh:.3f}s (Delta: {cf_fresh - rec.observed:+.3f}s)")
            assert cf_1lap <= rec.observed + 1e-5, "1-lap fresher tyre should be faster or equal!"
            assert cf_fresh <= rec.observed + 1e-5, "Fresh tyre should be faster or equal!"

    # Check 6: Exact Reconstructability
    print("\n5. Exact Algebraic Reconstructability Check:")
    reconstructed = df['base_pace'] + df['fuel_effect'] + df['track_evolution_effect'] + df['tyre_wear_effect'] + df['residual']
    recon_diff = (df['observed'] - reconstructed).abs().max()
    print(f"   - Max reconstruction discrepancy: {recon_diff:.8e} seconds")
    assert recon_diff < 1e-6, f"Decomposition terms do not reconstruct observed lap time! Discrepancy: {recon_diff}"

    print("\n>>> ALL PHASE 2 CAUSAL TYRE DECOMPOSITION TESTS PASSED CLEANLY <<<\n")


if __name__ == '__main__':
    run_test()
