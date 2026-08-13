"""
Pre-compute the live analysis cache for the default driver (VER #1, Singapore 2023 session 9165).
This saves the result to data/cache_9165_1.json so the /live page loads instantly.
Run from the backend directory: python precompute_cache.py
"""
import sys
import os

# Add project root to path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.live_analysis import get_live_analysis
import json

SESSION_KEY = 9165
DRIVERS_TO_CACHE = [1]  # VER — add more driver numbers here to pre-cache them

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    for driver in DRIVERS_TO_CACHE:
        cache_file = os.path.join(base_dir, "data", f"cache_{SESSION_KEY}_{driver}.json")

        if os.path.exists(cache_file):
            print(f"Cache already exists for driver {driver}: {cache_file}")
            continue

        print(f"Computing live analysis for session {SESSION_KEY}, driver {driver}...")
        print("This may take a minute on first run (heavy pandas computation + optional LLM calls)...")

        try:
            result = get_live_analysis(SESSION_KEY, driver)

            with open(cache_file, "w") as f:
                json.dump(result, f)

            print(f"Cached {len(result.get('samples', []))} samples -> {cache_file}")
            print(f"  File size: {os.path.getsize(cache_file) / 1024:.1f} KB")
        except Exception as e:
            print(f"Failed for driver {driver}: {e}")

if __name__ == "__main__":
    main()
