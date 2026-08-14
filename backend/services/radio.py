"""Backward-compatible import for the renamed voice intelligence service."""

from services.voice import get_voice_intelligence


get_radio_intelligence = get_voice_intelligence
