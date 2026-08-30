import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.live_analysis import get_live_analysis

grid = [1, 2, 4, 10, 11, 14, 16, 20, 22, 23, 24, 27, 31, 40, 44, 55, 63, 77, 81]
for d in grid:
    try:
        res = get_live_analysis(9165, d)
        samples = res.get('samples', [])
        print(f"Driver {d:2d}: SUCCESS ({len(samples)} samples)", flush=True)
    except Exception as e:
        print(f"Driver {d:2d}: FAILED -> {e}", flush=True)
