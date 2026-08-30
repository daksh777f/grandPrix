"""Lightweight shared identity helpers for cached radio events."""

import hashlib
import re
from urllib.parse import urlparse


def cache_stem(session_key: int, driver_number: int, recording_url: str) -> str:
    parsed_name = re.sub(r"[^A-Za-z0-9_.-]", "_", urlparse(recording_url).path.split("/")[-1]) or "radio"
    digest = hashlib.sha1(recording_url.encode("utf-8")).hexdigest()[:10]
    return f"{session_key}_{driver_number}_{parsed_name}_{digest}"


def event_id(session_key: int, driver_number: int, timestamp: str, lap: int | None, corner: str | None, progress: float | None) -> str:
    progress_key = "" if progress is None else f"{progress:.6f}"
    canonical = "|".join([
        str(session_key),
        str(driver_number),
        timestamp,
        str(lap or ""),
        corner or "",
        progress_key,
    ])
    return f"radio_{hashlib.sha1(canonical.encode('utf-8')).hexdigest()[:16]}"
