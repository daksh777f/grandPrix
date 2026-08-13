import requests
import json
import time

print("Testing radio endpoint...")
start = time.time()
try:
    res = requests.get("http://localhost:8000/api/radio/9165/1", timeout=300)
    data = res.json()
    print(f"Time taken: {time.time()-start:.2f}s")
    print(f"Messages count: {len(data.get('messages', []))}")
    if data.get('messages'):
        print(f"First message: {json.dumps(data['messages'][0], indent=2)}")
except Exception as e:
    print(f"Error: {e}")
