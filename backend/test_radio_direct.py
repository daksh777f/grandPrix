import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from services.radio import get_radio_intelligence

try:
    res = get_radio_intelligence(9165, 1)
    print("Messages returned:", len(res["messages"]))
except Exception as e:
    import traceback
    traceback.print_exc()
