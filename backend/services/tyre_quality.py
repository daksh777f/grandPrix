"""
Tyre Degradation Intelligence (TDI) - Lap Quality Flagging Engine.

Roadmap Context:
- Phase 1 of the 12-phase TDI architecture.
- Classifies every lap in a session with discrete quality flags (PIT_ENTRY, PIT_OUT,
  SC_LAP, VSC_LAP, TRAFFIC_LAP, PUSH_LAP, ANOMALOUS, or REPRESENTATIVE) to isolate
  clean pace data for causal decomposition and Bayesian state estimation.
- Follows the "flag, don't delete" architectural principle: every lap is preserved,
  and filtering is deferred to downstream fitting phases.

Subsequent Phases:
- Phase 2: Causal Pace Decomposition (tyre_decomposition.py)
- Phase 3: Bayesian Latent Tyre State + Cliff Detection (tyre_state.py)
- Phase 4: Counterfactual Engine + Post-Race Validator (tyre_validation.py)
- Phase 5: Strategy Simulator / Monte Carlo Pit Window (tyre_strategy.py)
- Phase 6-12: API, UI & Voice Integration
"""

import os
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Set
import numpy as np
import pandas as pd

try:
    from data.tyre_constants import TRAFFIC_GAP_THRESHOLD_SEC
except ImportError:
    from backend.data.tyre_constants import TRAFFIC_GAP_THRESHOLD_SEC


@dataclass
class LapQualityRecord:
    """Per-lap quality record capturing stint, tyre age, compound, and quality flags."""
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
    """Engine responsible for deterministic and statistical lap quality classification."""

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        else:
            self.base_dir = base_dir
        self._laps_df: Optional[pd.DataFrame] = None
        self._rc_df: Optional[pd.DataFrame] = None
        self._intervals_df: Optional[pd.DataFrame] = None

    def _load_data(self) -> None:
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

    def _extract_sc_vsc_laps(self, session_key: int) -> tuple[Set[int], Set[int]]:
        """Extract all laps during which Safety Car or Virtual Safety Car periods were active."""
        sc_laps: Set[int] = set()
        vsc_laps: Set[int] = set()

        if self._rc_df is None:
            return sc_laps, vsc_laps

        rc_session = self._rc_df[self._rc_df['session_key'] == session_key].sort_values('date')
        if rc_session.empty:
            return sc_laps, vsc_laps

        current_sc_start: Optional[int] = None
        current_vsc_start: Optional[int] = None

        for _, row in rc_session.iterrows():
            cat = str(row.get('category', ''))
            msg = str(row.get('message', '')).upper()
            lap_val = row.get('lap_number')
            lap_num = int(lap_val) if pd.notna(lap_val) else None

            if cat == 'SafetyCar' or 'SAFETY CAR' in msg:
                if 'VIRTUAL' in msg or 'VSC' in msg:
                    if 'DEPLOYED' in msg and lap_num is not None:
                        current_vsc_start = lap_num
                    elif ('ENDING' in msg or 'CLEAR' in msg) and lap_num is not None:
                        start = current_vsc_start if current_vsc_start is not None else lap_num
                        for l in range(start, lap_num + 1):
                            vsc_laps.add(l)
                        current_vsc_start = None
                else:
                    if 'DEPLOYED' in msg and lap_num is not None:
                        current_sc_start = lap_num
                    elif ('IN THIS LAP' in msg or 'ENDING' in msg or 'CLEAR' in msg) and lap_num is not None:
                        start = current_sc_start if current_sc_start is not None else lap_num
                        for l in range(start, lap_num + 1):
                            sc_laps.add(l)
                        current_sc_start = None

        # Flush any trailing unclosed state
        if current_sc_start is not None:
            sc_laps.add(current_sc_start)
        if current_vsc_start is not None:
            vsc_laps.add(current_vsc_start)

        return sc_laps, vsc_laps

    def flag_session(self, session_key: int, driver_number: int) -> List[LapQualityRecord]:
        """Produce a complete list of per-lap quality records for the specified driver and session."""
        self._load_data()
        if self._laps_df is None:
            return []

        driver_laps = self._laps_df[
            (self._laps_df['session_key'] == session_key) &
            (self._laps_df['driver_number'] == driver_number)
        ].sort_values('lap_number').reset_index(drop=True)

        if driver_laps.empty:
            return []

        sc_laps, vsc_laps = self._extract_sc_vsc_laps(session_key)

        driver_ints = None
        if self._intervals_df is not None:
            driver_ints = self._intervals_df[
                (self._intervals_df['session_key'] == session_key) &
                (self._intervals_df['driver_number'] == driver_number)
            ].sort_values('date')

        # Pass 1: Stint identification, pit boundaries, SC/VSC, and traffic detection
        records_draft = []
        current_stint = 1
        current_tyre_age = 1
        total_laps = len(driver_laps)

        for i, row in driver_laps.iterrows():
            lap_num = int(row['lap_number'])
            lap_dur = float(row['lap_duration']) if pd.notna(row.get('lap_duration')) else None
            is_pit_out = bool(row.get('is_pit_out_lap', False))

            if i > 0 and is_pit_out:
                current_stint += 1
                current_tyre_age = 1

            flags: List[str] = []

            if is_pit_out or lap_num == 1:
                flags.append('PIT_OUT')

            if i < total_laps - 1:
                next_row = driver_laps.iloc[i + 1]
                if bool(next_row.get('is_pit_out_lap', False)):
                    flags.append('PIT_ENTRY')

            if lap_num in sc_laps:
                flags.append('SC_LAP')
            elif lap_num in vsc_laps:
                flags.append('VSC_LAP')

            # Traffic detection (gap to car ahead <= 0.25s during lap window)
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

        # Pass 2: Statistical anomaly & push lap detection per stint
        stint_groups: Dict[int, List[Dict[str, Any]]] = {}
        for rec in records_draft:
            s_num = rec['stint_number']
            if s_num not in stint_groups:
                stint_groups[s_num] = []
            stint_groups[s_num].append(rec)

        final_records: List[LapQualityRecord] = []
        for s_num, stint_recs in stint_groups.items():
            clean_durations = [
                r['lap_duration'] for r in stint_recs
                if r['lap_duration'] is not None and not any(f in r['flags'] for f in ['PIT_ENTRY', 'PIT_OUT', 'SC_LAP', 'VSC_LAP'])
            ]

            if len(clean_durations) >= 3:
                median_pace = float(np.median(clean_durations))
                std_pace = float(np.std(clean_durations))
                if std_pace < 0.05:
                    std_pace = 0.50
            elif clean_durations:
                median_pace = float(np.median(clean_durations))
                std_pace = 1.0
            else:
                median_pace = 100.0
                std_pace = 2.0

            for rec in stint_recs:
                dur = rec['lap_duration']
                flags = list(rec['flags'])

                if dur is not None and not any(f in flags for f in ['PIT_ENTRY', 'PIT_OUT', 'SC_LAP', 'VSC_LAP']):
                    if dur < median_pace - (1.5 * std_pace):
                        flags.append('PUSH_LAP')
                    elif dur > median_pace + (3.0 * std_pace):
                        flags.append('ANOMALOUS')

                # Representative check: only if zero disqualifying flags exist
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


# Module-level convenience functions

_flagger_instance: Optional[LapQualityFlagger] = None

def _get_flagger() -> LapQualityFlagger:
    global _flagger_instance
    if _flagger_instance is None:
        _flagger_instance = LapQualityFlagger()
    return _flagger_instance


def classify_lap_quality(
    session_key: int,
    driver_number: int,
    lap_number: int
) -> Dict[str, Any]:
    """Classify a single lap's quality and return its dictionary record."""
    flagger = _get_flagger()
    records = flagger.flag_session(session_key, driver_number)
    for rec in records:
        if rec.lap_number == lap_number:
            return rec.to_dict()
    return {
        "lap_number": lap_number,
        "lap_duration": None,
        "stint_number": 1,
        "tyre_age": lap_number,
        "compound": "UNKNOWN",
        "compound_is_inferred": False,
        "flags": ["ANOMALOUS"]
    }


def get_session_lap_quality(
    session_key: int,
    driver_number: int
) -> List[Dict[str, Any]]:
    """Retrieve full lap quality classification list for a driver session."""
    flagger = _get_flagger()
    records = flagger.flag_session(session_key, driver_number)
    return [r.to_dict() for r in records]


def filter_representative_laps(
    session_key: int,
    driver_number: int,
    stint_number: Optional[int] = None
) -> pd.DataFrame:
    """
    Filter and return clean REPRESENTATIVE laps as a pandas DataFrame
    for downstream causal decomposition and Bayesian modeling.
    """
    records = get_session_lap_quality(session_key, driver_number)
    rows = []
    for r in records:
        if 'REPRESENTATIVE' in r['flags']:
            if stint_number is None or r['stint_number'] == stint_number:
                rows.append(r)
    return pd.DataFrame(rows)
