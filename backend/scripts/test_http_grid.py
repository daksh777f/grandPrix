import urllib.request
import json

drivers = [1, 2, 4, 10, 11, 14, 16, 20, 22, 23, 24, 27, 31, 40, 44, 55, 63, 77, 81]
print("Testing live analysis HTTP endpoint across all 19 drivers...")
for d in drivers:
    try:
        url = f"http://127.0.0.1:8000/api/live-analysis/9165/{d}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            count = len(data.get("samples", []))
            print(f"Driver {d:2d}: 200 OK ({count} samples)")
    except Exception as e:
        print(f"Driver {d:2d}: ERROR -> {e}")
