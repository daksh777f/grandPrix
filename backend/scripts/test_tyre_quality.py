import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from services.tyre_quality import LapQualityFlagger, filter_representative_laps


def run_test():
    session_key = 9165
    driver_number = 1

    print("=" * 80)
    print(f"TYRE QUALITY FLAGGING AUDIT: Session {session_key}, Driver {driver_number} (Verstappen)")
    print("=" * 80)

    flagger = LapQualityFlagger()
    records = flagger.flag_session(session_key, driver_number)

    if not records:
        print("ERROR: No records returned!")
        return

    data = [r.to_dict() for r in records]
    df = pd.DataFrame(data)

    print(f"\nTotal laps: {len(records)}")
    print("\nPer-Lap Breakdown:")
    print("-" * 80)
    print(f"{'Lap':<5} | {'Stint':<5} | {'Age':<5} | {'Duration (s)':<12} | {'Compound':<10} | {'Flags'}")
    print("-" * 80)
    for r in records:
        dur_str = f"{r.lap_duration:.3f}" if r.lap_duration is not None else "N/A"
        flags_str = ", ".join(r.flags)
        print(f"{r.lap_number:<5} | {r.stint_number:<5} | {r.tyre_age:<5} | {dur_str:<12} | {r.compound:<10} | {flags_str}")

    # Aggregations & Distribution
    flag_counts = {}
    for r in records:
        for f in r.flags:
            flag_counts[f] = flag_counts.get(f, 0) + 1

    rep_count = flag_counts.get("REPRESENTATIVE", 0)
    rep_pct = (rep_count / len(records)) * 100.0

    print("\n" + "=" * 80)
    print("SUMMARY METRICS:")
    print("=" * 80)
    for flag, count in sorted(flag_counts.items()):
        print(f"  - {flag:<15}: {count} laps ({count/len(records)*100:.1f}%)")

    print(f"\nRepresentative Lap Ratio: {rep_pct:.1f}% ({rep_count}/{len(records)} laps)")
    assert rep_pct >= 40.0, f"Representative lap ratio ({rep_pct:.1f}%) is below 40% threshold!"

    # Verify stint resets
    stint_1_laps = [r for r in records if r.stint_number == 1]
    stint_2_laps = [r for r in records if r.stint_number == 2]

    print(f"\nStint 1 total laps: {len(stint_1_laps)} (Tyre age 1 to {stint_1_laps[-1].tyre_age})")
    print(f"Stint 2 total laps: {len(stint_2_laps)} (Tyre age 1 to {stint_2_laps[-1].tyre_age})")

    assert stint_1_laps[-1].tyre_age == len(stint_1_laps), "Stint 1 tyre age mismatch"
    assert stint_2_laps[0].tyre_age == 1, "Stint 2 tyre age did not reset to 1"
    assert stint_2_laps[-1].tyre_age == len(stint_2_laps), "Stint 2 tyre age mismatch"

    # Test filtering helper
    rep_df = filter_representative_laps(session_key, driver_number)
    print(f"\nfilter_representative_laps() returned: {len(rep_df)} rows")
    assert len(rep_df) == rep_count, "filter_representative_laps count mismatch"

    print("\n>>> ALL PHASE 1 TYRE QUALITY TESTS PASSED CLEANLY <<<")


if __name__ == '__main__':
    run_test()
