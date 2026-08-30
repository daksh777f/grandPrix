import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import numpy as np
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any

from data.tyre_constants import TRAFFIC_GAP_THRESHOLD_SEC

@dataclass
class LapQualityRecord:
    lap_number: int
    lap_duration: Optional[float]
    stint_number: int
    tyre_age: int
    compound: str = "UNKNOWN"
    compound_is_inferred: bool = False
    flags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class LapQualityFlagger:
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        else:
            self.base_dir = base_dir
        self._laps_df = None
        self._rc_df = None
        self._intervals_df = None

    def _load_data(self):
        if self._laps_df is None:
            laps_path = os.path.join(self.base_dir, "data", "laps.csv")
            if os.path.exists(laps_path):
                df = pd.read_csv(laps_path)
                df['date_start'] = pd.to_datetime(df['date_start'], format='ISO8601', errors='coerce')
                self._laps_df = df

        if self._rc_df is None:
            rc_path = os.path.join(self.base_dir, "data", "race_control.csv")
            if os.path.exists(rc_path):
                df = pd.read_csv(rc_path)
                df['date'] = pd.to_datetime(df['date'], format='ISO8601', errors='coerce')
                self._rc_df = df

        if self._intervals_df is None:
            int_path = os.path.join(self.base_dir, "data", "intervals.csv")
            if os.path.exists(int_path):
                df = pd.read_csv(int_path)
                df['date'] = pd.to_datetime(df['date'], format='ISO8601', errors='coerce')
                self._intervals_df = df

    def flag_session(self, session_key: int, driver_number: int) -> List[LapQualityRecord]:
        self._load_data()
        if self._laps_df is None:
            return []

        # Filter laps for driver and session
        driver_laps = self._laps_df[
            (self._laps_df['session_key'] == session_key) &
            (self._laps_df['driver_number'] == driver_number)
        ].sort_values('lap_number').reset_index(drop=True)

        if driver_laps.empty:
            return []

        # 1. Parse Safety Car & VSC laps from race_control.csv
        sc_laps = set()
        vsc_laps = set()
        if self._rc_df is not None:
            rc_session = self._rc_df[self._rc_df['session_key'] == session_key].sort_values('date')
            sc_active = False
            vsc_active = False
            
            # Map by messages / category
            for _, row in rc_session.iterrows():
                cat = str(row.get('category', ''))
                msg = str(row.get('message', '')).upper()
                lap_num = row.get('lap_number')
                
                if cat == 'SafetyCar' or 'SAFETY CAR' in msg:
                    if 'VIRTUAL' in msg or 'VSC' in msg:
                        if 'DEPLOYED' in msg:
                            vsc_active = True
                        elif 'ENDING' in msg or 'CLEAR' in msg:
                            vsc_active = False
                        if pd.notna(lap_num):
                            vsc_laps.add(int(lap_num))
                    else:
                        if 'DEPLOYED' in msg:
                            sc_active = True
                        elif 'IN THIS LAP' in msg or 'ENDING' in msg or 'CLEAR' in msg:
                            sc_active = False
                        if pd.notna(lap_num):
                            sc_laps.add(int(lap_num))

        # 2. Driver interval lookup for traffic
        driver_ints = None
        if self._intervals_df is not None:
            driver_ints = self._intervals_df[
                (self._intervals_df['session_key'] == session_key) &
                (self._intervals_df['driver_number'] == driver_number)
            ].sort_values('date')

        # 3. Determine Stints and initial flags (Pit Out, Pit Entry, SC, VSC, Traffic)
        records_draft = []
        current_stint = 1
        current_tyre_age = 1

        total_laps = len(driver_laps)
        for i, row in driver_laps.iterrows():
            lap_num = int(row['lap_number'])
            lap_dur = float(row['lap_duration']) if pd.notna(row.get('lap_duration')) else None
            is_pit_out = bool(row.get('is_pit_out_lap', False))
            
            # Check if this lap is a pit out lap
            # (Lap 1 is also starting stint 1 with age 1)
            if i > 0 and is_pit_out:
                current_stint += 1
                current_tyre_age = 1

            flags = []
            
            # Pit out flag
            if is_pit_out or lap_num == 1:
                flags.append('PIT_OUT')

            # Pit entry flag: Check if next lap is pit_out
            if i < total_laps - 1:
                next_row = driver_laps.iloc[i + 1]
                if bool(next_row.get('is_pit_out_lap', False)):
                    flags.append('PIT_ENTRY')

            # SC / VSC flags
            if lap_num in sc_laps:
                flags.append('SC_LAP')
            elif lap_num in vsc_laps:
                flags.append('VSC_LAP')

            # Traffic check: gap to car ahead during lap window
            date_start = row.get('date_start')
            if pd.notna(date_start) and driver_ints is not None and not driver_ints.empty:
                if i < total_laps - 1 and pd.notna(driver_laps.iloc[i + 1].get('date_start')):
                    date_end = driver_laps.iloc[i + 1]['date_start']
                elif lap_dur:
                    date_end = date_start + pd.Timedelta(seconds=lap_dur)
                else:
                    date_end = date_start + pd.Timedelta(seconds=110)

                lap_intervals = driver_ints[(driver_ints['date'] >= date_start) & (driver_ints['date'] < date_end)]
                if not lap_intervals.empty:
                    valid_intervals = lap_intervals['interval'].dropna()
                    if not valid_intervals.empty and (valid_intervals <= TRAFFIC_GAP_THRESHOLD_SEC).any():
                        flags.append('TRAFFIC_LAP')

            records_draft.append({
                'lap_number': lap_num,
                'lap_duration': lap_dur,
                'stint_number': current_stint,
                'tyre_age': current_tyre_age,
                'compound': "UNKNOWN",
                'compound_is_inferred': False,
                'flags': flags
            })
            current_tyre_age += 1

        # 4. Statistical anomaly & push lap detection per stint
        # Compute stint baseline from clean non-pit/non-SC laps
        stint_groups = {}
        for rec in records_draft:
            s_num = rec['stint_number']
            if s_num not in stint_groups:
                stint_groups[s_num] = []
            stint_groups[s_num].append(rec)

        final_records = []
        for s_num, stint_recs in stint_groups.items():
            # Filter non-pit, non-SC laps to calculate stint pace distribution
            clean_durations = [
                r['lap_duration'] for r in stint_recs 
                if r['lap_duration'] is not None and not any(f in r['flags'] for f in ['PIT_ENTRY', 'PIT_OUT', 'SC_LAP', 'VSC_LAP'])
            ]

            if len(clean_durations) >= 3:
                median_pace = np.median(clean_durations)
                std_pace = np.std(clean_durations) if np.std(clean_durations) > 0.05 else 0.50
            elif clean_durations:
                median_pace = np.median(clean_durations)
                std_pace = 1.0
            else:
                median_pace = 100.0
                std_pace = 2.0

            for rec in stint_recs:
                dur = rec['lap_duration']
                flags = rec['flags']
                
                # Check for push lap or anomalous pace
                if dur is not None and not any(f in flags for f in ['PIT_ENTRY', 'PIT_OUT', 'SC_LAP', 'VSC_LAP']):
                    if dur < median_pace - (1.5 * std_pace):
                        flags.append('PUSH_LAP')
                    elif dur > median_pace + (3.0 * std_pace):
                        flags.append('ANOMALOUS')

                # Representative flag: ONLY if no disqualifying flags exist
                if not flags:
                    flags.append('REPRESENTATIVE')

                final_records.append(LapQualityRecord(
                    lap_number=rec['lap_number'],
                    lap_duration=rec['lap_duration'],
                    stint_number=rec['stint_number'],
                    tyre_age=rec['tyre_age'],
                    compound=rec['compound'],
                    compound_is_inferred=rec['compound_is_inferred'],
                    flags=flags
                ))

        return final_records

if __name__ == '__main__':
    flagger = LapQualityFlagger()
    records = flagger.flag_session(9165, 1)
    df = pd.DataFrame([r.to_dict() for r in records])
    print(df[['lap_number', 'stint_number', 'tyre_age', 'lap_duration', 'flags']].to_string())
    
    # Print summary statistics
    flag_counts = {}
    for r in records:
        for f in r.flags:
            flag_counts[f] = flag_counts.get(f, 0) + 1
    print("\nFlag summary:", flag_counts)
    print("Total laps:", len(records))
    print(f"Representative %: {(flag_counts.get('REPRESENTATIVE', 0) / len(records)) * 100:.1f}%")
