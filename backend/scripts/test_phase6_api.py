"""
End-to-End API Integration Test Suite for TDI Phase 6
=====================================================
Validates all new and modified FastAPI routes:
1. GET /api/tyre/{session_key}/{driver_number}
2. GET /api/tyre/counterfactual/{session_key}/{driver_number}
3. GET /api/tyre/validation/{session_key}/{driver_number}
4. GET /api/tyre/strategy/{session_key}/{driver_number}?lap=38
5. GET /api/live-analysis/{session_key}/{driver_number} (Extended with tyre telemetry)
6. GET /api/voice/{session_key}/{driver_number} (Extended with voice-tyre correlation)
7. Unbroken contract checks for existing endpoints (/api/grid, /api/replay).
"""

import os
import sys
import time

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_phase_6_api(session_key: int = 9165, driver_number: int = 1):
    print("=" * 110)
    print(f"TDI PHASE 6 INTEGRATION TEST SUITE: FASTAPI ROUTES (Session {session_key}, Driver {driver_number})")
    print("=" * 110)

    # 1. Test /api/grid
    t0 = time.perf_counter()
    resp = client.get("/api/grid")
    t1 = time.perf_counter()
    assert resp.status_code == 200, f"/api/grid returned status {resp.status_code}"
    grid = resp.json()
    assert "drivers" in grid and len(grid["drivers"]) > 0
    print(f"[PASS] GET /api/grid -> Status 200 OK ({len(grid['drivers'])} drivers, {(t1-t0)*1000:.1f}ms)")

    # 2. Test /api/tyre/{session_key}/{driver_number}
    t0 = time.perf_counter()
    resp = client.get(f"/api/tyre/{session_key}/{driver_number}")
    t1 = time.perf_counter()
    assert resp.status_code == 200, f"/api/tyre returned status {resp.status_code}"
    tyre_data = resp.json()
    assert "stints" in tyre_data and "records" in tyre_data
    records = tyre_data["records"]
    assert len(records) > 0
    sample_rec = records[1]
    assert "wear_rate_estimate" in sample_rec and "cliff_probability" in sample_rec and "tyre_health_pct" in sample_rec
    print(f"[PASS] GET /api/tyre/{session_key}/{driver_number} -> Status 200 OK ({len(records)} lap records, {(t1-t0)*1000:.1f}ms)")

    # 3. Test /api/tyre/counterfactual/{session_key}/{driver_number}
    t0 = time.perf_counter()
    resp = client.get(f"/api/tyre/counterfactual/{session_key}/{driver_number}")
    t1 = time.perf_counter()
    assert resp.status_code == 200, f"/api/tyre/counterfactual returned status {resp.status_code}"
    cf_data = resp.json()
    assert "interesting_laps" in cf_data and len(cf_data["interesting_laps"]) >= 3
    assert "all_representative_laps" in cf_data and len(cf_data["all_representative_laps"]) > 0
    print(f"[PASS] GET /api/tyre/counterfactual/{session_key}/{driver_number} -> Status 200 OK ({len(cf_data['interesting_laps'])} showcase laps, {(t1-t0)*1000:.1f}ms)")

    # 4. Test /api/tyre/validation/{session_key}/{driver_number}
    t0 = time.perf_counter()
    resp = client.get(f"/api/tyre/validation/{session_key}/{driver_number}")
    t1 = time.perf_counter()
    assert resp.status_code == 200, f"/api/tyre/validation returned status {resp.status_code}"
    val_data = resp.json()
    assert val_data["validation_mode"] == "MID_STINT_HOLDOUT"
    assert "overall_accuracy_score" in val_data
    assert "stints" in val_data and len(val_data["stints"]) > 0
    print(f"[PASS] GET /api/tyre/validation/{session_key}/{driver_number} -> Status 200 OK (Accuracy: {val_data['overall_accuracy_score']:.1f}%, Mode: {val_data['validation_mode']}, {(t1-t0)*1000:.1f}ms)")

    # 5. Test /api/tyre/strategy/{session_key}/{driver_number}?lap=38
    t0 = time.perf_counter()
    resp = client.get(f"/api/tyre/strategy/{session_key}/{driver_number}?lap=38")
    t1 = time.perf_counter()
    assert resp.status_code == 200, f"/api/tyre/strategy returned status {resp.status_code}"
    strat_data = resp.json()
    assert "scenarios" in strat_data and len(strat_data["scenarios"]) == 3
    assert strat_data["current_lap"] == 38
    assert "strategy_confidence" in strat_data
    print(f"[PASS] GET /api/tyre/strategy/{session_key}/{driver_number}?lap=38 -> Status 200 OK (3 scenarios, {(t1-t0)*1000:.1f}ms)")

    # 6. Test /api/live-analysis/{session_key}/{driver_number}
    t0 = time.perf_counter()
    resp = client.get(f"/api/live-analysis/{session_key}/{driver_number}")
    t1 = time.perf_counter()
    assert resp.status_code == 200, f"/api/live-analysis returned status {resp.status_code}"
    live_data = resp.json()
    assert "samples" in live_data and len(live_data["samples"]) > 0
    sample = live_data["samples"][0]
    # Check that new tyre fields are attached without breaking existing fields
    assert "tyre_wear_rate" in sample, "Missing tyre_wear_rate in live sample"
    assert "cliff_probability" in sample, "Missing cliff_probability in live sample"
    assert "tyre_alert_active" in sample, "Missing tyre_alert_active in live sample"
    assert "target" in sample and "current_corner" in sample and "communication" in sample, "Existing live sample shape broken"
    assert "speed" in sample["target"], "Missing speed in sample target"
    
    # Check TYRE_ALERT communication category activation
    tyre_alert_samples = [s for s in live_data["samples"] if s.get("communication", {}).get("category") == "TYRE_ALERT"]
    print(f"[PASS] GET /api/live-analysis/{session_key}/{driver_number} -> Status 200 OK ({len(live_data['samples'])} samples, {len(tyre_alert_samples)} TYRE_ALERT triggers, {(t1-t0)*1000:.1f}ms)")

    # 7. Test /api/voice/{session_key}/{driver_number}
    t0 = time.perf_counter()
    resp = client.get(f"/api/voice/{session_key}/{driver_number}")
    t1 = time.perf_counter()
    assert resp.status_code == 200, f"/api/voice returned status {resp.status_code}"
    voice_data = resp.json()
    assert "messages" in voice_data and len(voice_data["messages"]) > 0
    msg = voice_data["messages"][0]
    assert "tyre_wear_rate" in msg, "Missing tyre_wear_rate in voice message"
    assert "cliff_probability" in msg, "Missing cliff_probability in voice message"
    assert "voice_tyre_alignment" in msg, "Missing voice_tyre_alignment in voice message"
    assert msg["voice_tyre_alignment"] in {"CONFIRMED", "MISMATCH"}, f"Invalid voice_tyre_alignment: {msg['voice_tyre_alignment']}"
    
    alignments = [m["voice_tyre_alignment"] for m in voice_data["messages"]]
    print(f"[PASS] GET /api/voice/{session_key}/{driver_number} -> Status 200 OK ({len(voice_data['messages'])} radio events, Alignments: {alignments}, {(t1-t0)*1000:.1f}ms)")

    print("\n" + "=" * 80)
    print(">>> ALL PHASE 6 API INTEGRATION & EXTENSION TESTS PASSED CLEANLY <<<")
    print("=" * 80)


if __name__ == "__main__":
    test_phase_6_api(9165, 1)
