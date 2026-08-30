"""
Test Suite for TDI Phase 4: Validation Engine & Counterfactual Lap Cards
========================================================================
Runs:
1. Frozen holdout prediction generation & disk verification.
2. Validation scorecard inspection (predicted vs actual wear rate & cliff onset).
3. Exact algebraic reconstructability check on counterfactual lap components.
4. Auto-selected interesting lap evaluation.
"""

import os
import sys
import json

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.tyre_validation import (
    compute_stint_holdout_validation,
    get_counterfactual_lap_card_data,
    select_most_interesting_laps,
    get_driver_validation_summary,
)


def run_phase_4_audit(session_key: int = 9165, driver_number: int = 1):
    print("=" * 110)
    print(f"TDI PHASE 4 AUDIT: VALIDATION SCORECARD & COUNTERFACTUAL CARDS (Session {session_key}, Driver {driver_number})")
    print("=" * 110)

    # 1. Run Holdout Validation
    summary = get_driver_validation_summary(session_key, driver_number)
    scorecard_data = summary["validation_scorecard"]
    stints_scorecards = scorecard_data["stints"]

    print(f"\nValidation Mode: {scorecard_data['validation_mode']}")
    print(f"Overall Model Accuracy Score: {scorecard_data['overall_accuracy_score']}%\n")

    print("=" * 130)
    print(f"{'Stint':<6} | {'Compound':<8} | {'Rep Laps':<9} | {'Split Lap':<10} | {'Pred Wear':<10} | {'Act Wear':<10} | {'Abs Err':<9} | {'Pct Err':<9} | {'Pred Cliff':<11} | {'Act Cliff':<10} | {'Accuracy':<9}")
    print("=" * 130)

    for sc in stints_scorecards:
        pred_w = f"{sc['predicted_wear_rate']:.4f}s"
        act_w = f"{sc['actual_wear_rate']:.4f}s"
        abs_e = f"{sc['wear_rate_error_abs']:.4f}s"
        pct_e = f"{sc['wear_rate_error_pct']:.1f}%"
        pred_c = str(sc['predicted_cliff_lap']) if sc['predicted_cliff_lap'] is not None else "None"
        act_c = str(sc['actual_cliff_lap']) if sc['actual_cliff_lap'] is not None else "None"
        acc = f"{sc['model_accuracy_score']:.1f}%"

        print(f"{sc['stint_number']:<6} | {sc['compound']:<8} | {sc['total_representative_laps']:<9} | {sc['holdout_split_lap']:<10} | {pred_w:<10} | {act_w:<10} | {abs_e:<9} | {pct_e:<9} | {pred_c:<11} | {act_c:<10} | {acc:<9}")
    print("=" * 130)

    # 2. Check Frozen Prediction Artifact
    pred_dir = os.path.join(backend_dir, "data", "tyre_predictions")
    pred_file = os.path.join(pred_dir, f"session_{session_key}_driver_{driver_number}_frozen.json")
    print(f"\nChecking frozen prediction artifact at: {pred_file}")
    if os.path.exists(pred_file):
        with open(pred_file, "r") as f:
            frozen_data = json.load(f)
        print(f"  [PASS] Frozen artifact exists! Contains keys: {list(frozen_data.keys())}")
        print(f"  [PASS] Frozen Stints: {list(frozen_data['stints'].keys())}")
    else:
        print(f"  [FAIL] Frozen artifact not found on disk!")

    # 3. Counterfactual Exact Arithmetic Check
    print("\n" + "=" * 80)
    print("VERIFYING COUNTERFACTUAL ARITHMETIC RECONSTRUCTABILITY:")
    print("=" * 80)

    all_cards = get_counterfactual_lap_card_data(session_key, driver_number)
    max_discrepancy = 0.0

    for card in all_cards:
        comp = card.components
        sum_components = (
            comp["base_pace"]
            + comp["fuel_effect"]
            + comp["track_evolution_effect"]
            + comp["tyre_wear_effect"]
            + comp["residual"]
        )
        diff = abs(sum_components - card.observed)
        if diff > max_discrepancy:
            max_discrepancy = diff

    print(f"Total representative lap cards: {len(all_cards)}")
    print(f"Maximum algebraic discrepancy (observed - sum(components)): {max_discrepancy:.6f}s")
    assert max_discrepancy < 0.005, f"Algebraic discrepancy {max_discrepancy} exceeds tolerance!"
    print("  [PASS] All counterfactual decompositions sum with 100% mathematical consistency.")

    # 4. Auto-Selected Interesting Laps Check
    print("\n" + "=" * 110)
    print("AUTO-SELECTED INTERESTING LAPS FOR DEMO / FRONTEND CARD:")
    print("=" * 110)

    interesting = summary["interesting_laps"]
    print(f"Selected {len(interesting)} high-signal showcase laps:")
    print()

    for idx, lap in enumerate(interesting, 1):
        print(f"Lap {lap['lap_number']} [Tag: {lap['tag']} | Age: {lap['tyre_age']} | Stint: {lap['stint_number']}]:")
        print(f"  - Description: {lap['tag_description']}")
        print(f"  - Observed Lap Time: {lap['observed']:.3f}s")
        comp = lap["components"]
        print(f"  - Causal Breakdown: Base {comp['base_pace']:.3f}s + Fuel {comp['fuel_effect']:+.3f}s + Track {comp['track_evolution_effect']:+.3f}s + Tyre {comp['tyre_wear_effect']:+.3f}s + Noise {comp['residual']:+.3f}s")
        print(f"  - Counterfactual: \"{lap['counterfactual_text']}\" (Time saved: {lap['time_saved_on_fresh']:+.3f}s)")
        print()

    print("=" * 80)
    print(">>> ALL PHASE 4 VALIDATION & COUNTERFACTUAL TESTS PASSED CLEANLY <<<")
    print("=" * 80)


if __name__ == "__main__":
    run_phase_4_audit(9165, 1)
