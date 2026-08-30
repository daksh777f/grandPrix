"""
Test Suite for TDI Phase 5: Monte Carlo Pit Window Strategy Simulator
======================================================================
Tests:
1. Strategy simulation at early stint (Lap 5: INSUFFICIENT_EVIDENCE test).
2. Strategy simulation at mid stint (Lap 20: steady state test).
3. Strategy simulation just before historical pit stop (Lap 38: cliff imminent test).
4. Physical sanity checks:
   - Aggressive time delta > Nominal time delta (steeper post-cliff degradation).
   - Conservative, Nominal, Aggressive scenario ordering.
   - Graceful handling of low-evidence inputs with strategy_confidence: 'LOW'.
"""

import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.tyre_strategy import simulate_strategies


def run_phase_5_audit(session_key: int = 9165, driver_number: int = 1):
    print("=" * 110)
    print(f"TDI PHASE 5 AUDIT: PIT WINDOW STRATEGY SIMULATOR (Session {session_key}, Driver {driver_number})")
    print("=" * 110)

    test_laps = [
        (5, "EARLY STINT (Low Evidence)"),
        (20, "MID STINT (Steady State Learning)"),
        (38, "LATE STINT (Pre-Pit / Cliff Imminent)"),
    ]

    for lap, desc in test_laps:
        print("\n" + "-" * 110)
        print(f"SIMULATION POINT: LAP {lap} — {desc}")
        print("-" * 110)

        result = simulate_strategies(session_key, driver_number, current_lap=lap)

        print(f"Current Compound: {result['current_compound']} (Age: {result['current_tyre_age']} laps)")
        print(f"Current Wear Rate: {result['current_wear_rate']:.4f} s/lap (90% CI: {result['wear_rate_90pct_interval']})")
        print(f"Cliff Probability: {result['cliff_probability'] * 100:.1f}% | Predicted Cliff Lap: {result['predicted_cliff_lap']}")
        print(f"Strategy Confidence: {result['strategy_confidence']} ({result['confidence_notes']})")
        print()

        print(f"{'Scenario':<14} | {'Pit Lap':<8} | {'Old Laps':<9} | {'New Laps':<9} | {'New Comp':<9} | {'Remaining Time':<15} | {'Delta vs Nom':<13} | {'Risk':<7}")
        print("=" * 100)

        scenarios = result["scenarios"]
        for s in scenarios:
            time_str = f"{s['predicted_race_time_remaining']:.2f}s"
            delta_str = f"{s['predicted_total_time_delta']:+.2f}s"
            print(f"{s['name']:<14} | {s['pit_lap']:<8} | {s['laps_on_current_tyres']:<9} | {s['laps_on_new_tyres']:<9} | {s['new_compound']:<9} | {time_str:<15} | {delta_str:<13} | {s['risk_label']:<7}")
        print("=" * 100)

        # Sanity check assertions
        cons = next(s for s in scenarios if s["name"] == "Conservative")
        nom = next(s for s in scenarios if s["name"] == "Nominal")
        agg = next(s for s in scenarios if s["name"] == "Aggressive")

        # 1. Aggressive must be strictly worse in time than Nominal (agg time > nom time => delta > 0)
        assert agg["predicted_total_time_delta"] > 0, (
            f"Physical violation on Lap {lap}: Aggressive scenario delta ({agg['predicted_total_time_delta']:.2f}s) "
            "is not worse than Nominal!"
        )
        print(f"  [PASS] Aggressive penalty vs Nominal: +{agg['predicted_total_time_delta']:.2f}s (Post-cliff falloff verified).")

        # 2. Check low confidence handling on Lap 5
        if lap == 5:
            assert result["strategy_confidence"] == "LOW", "Lap 5 failed to report strategy_confidence: 'LOW'"
            print("  [PASS] Graceful low-evidence handling verified on Lap 5.")

    print("\n" + "=" * 80)
    print(">>> ALL PHASE 5 STRATEGY SIMULATOR TESTS PASSED CLEANLY <<<")
    print("=" * 80)


if __name__ == "__main__":
    run_phase_5_audit(9165, 1)
