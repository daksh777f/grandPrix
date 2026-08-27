import os
import json
import urllib.request

def generate_race_engineer_advice(corner_metrics: dict) -> dict:
    """
    Takes a dictionary of deterministic corner metrics.
    Calls the LLM to generate natural race-engineer advice.
    Returns a dictionary mapping corner names to dicts containing 'message' and 'advice'.
    """
    model = os.getenv("OLLAMA_MODEL", "llama3:latest")

    url = "http://127.0.0.1:11434/api/chat"
    headers = {
        "Content-Type": "application/json"
    }

    prompts = []
    for corner, metrics in corner_metrics.items():
        if metrics['diagnosis'] == "GOOD" or metrics['diagnosis'] == "None":
            continue

        prompts.append({
            "corner": corner,
            "diagnosis": metrics['diagnosis'],
            "confidence": 0.85,
            "entry_speed_delta": metrics['entry_speed_delta'],
            "minimum_speed_delta": metrics['minimum_speed_delta'],
            "exit_speed_delta": metrics['exit_speed_delta'],
            "braking_delta": metrics['braking_delta'],
            "estimated_time_delta": metrics['time_loss'],
            "race_context": metrics.get('race_context', {})
        })

    if not prompts:
        return _fallback_advice(corner_metrics)

    system_prompt = """You are a real-time AI race engineer for an F1 driver.
You are given a list of corner telemetry issues comparing your driver to the benchmark driver, along with optional macro race context (position, battles, gaps).
For each corner, provide a concise interpretation of the problem and actionable advice.

If `battle_active` is true and `is_defending` is true, incorporate defensive advice into your response (e.g. "protect the inside").
If `position_event` indicates a gain, you may acknowledge the good move.
If there is no battle active, do not mention battles or gaps.
Do NOT invent competitor names, gaps, positions, battles, or attack states. Use only the provided `race_context`.

Respond ONLY in valid JSON matching this schema exactly:
{
  "corners": [
    {
      "corner": "T7",
      "message": "You're braking 12m earlier than the benchmark.",
      "advice": "Brake later into T7 and carry more speed through the entry.",
      "priority": "HIGH"
    }
  ]
}
Do not invent telemetry. Prioritize the single most important issue per corner.
"""

    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(prompts)}
        ],
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }

    try:
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode('utf-8'))
            content = result.get('message', {}).get('content', '{}').strip()

            # Strip markdown formatting if present
            if content.startswith("```"):
                content = content.split("```json")[-1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()

            try:
                parsed = json.loads(content)
            except json.JSONDecodeError:
                print(f"Failed to parse LLM JSON: {content}")
                return _fallback_advice(corner_metrics)

            results = _fallback_advice(corner_metrics)
            for item in parsed.get("corners", []):
                corner = item.get("corner")
                if corner in results:
                    msg = item.get("message", "")
                    adv = item.get("advice", "")
                    # Keep message and advice separate
                    results[corner] = {
                        "message": msg,
                        "advice": adv
                    }
            return results

    except Exception as e:
        print(f"LLM failure or unavailable: {e}")
        return _fallback_advice(corner_metrics)

def _fallback_advice(corner_metrics: dict) -> dict:
    results = {}
    for corner, metrics in corner_metrics.items():
        diagnosis = metrics.get('diagnosis', 'None')
        message = "Monitoring telemetry."
        advice = metrics.get('advice', 'Keep pushing.')

        if diagnosis == "EARLY_BRAKING":
            message = f"You are braking {abs(metrics.get('braking_delta', 0))}m earlier than benchmark."
        elif diagnosis == "LATE_THROTTLE":
            message = f"Throttle application is {metrics.get('throttle_delay', 0)}s later than benchmark."
        elif diagnosis == "LOW_MIN_SPEED":
            message = f"Minimum apex speed is {abs(metrics.get('minimum_speed_delta', 0))} km/h too slow."
        elif diagnosis == "LOW_EXIT_SPEED":
            message = f"Exit speed is down by {abs(metrics.get('exit_speed_delta', 0))} km/h."

        results[corner] = {
            "message": message,
            "advice": advice
        }
    return results


def generate_voice_interpretation(payload: dict) -> dict:
    """Phrase voice and race evidence without performing audio analysis."""
    transcript = payload.get("transcript")
    voice = payload.get("voice", {})
    context = payload.get("context", {})
    performance = context.get("performance", {})
    race_context = context.get("race_context", {})
    corner = context.get("corner") or "the current section"
    is_straight = corner == "Straight"

    fallback = {
        "message": "Recent radio provides driver context; no corner diagnosis is attached." if is_straight else f"The transmission is synchronized with {corner} telemetry.",
        "advice": "Follow the team's race guidance and manage the current situation." if is_straight else f"Keep monitoring {corner} and follow the deterministic car diagnosis.",
        "status": "FALLBACK",
    }
    diagnosis = performance.get("diagnosis")
    if diagnosis == "EARLY_BRAKING":
        fallback["message"] = f"The transmission is synchronized with an entry deficit at {corner}."
        fallback["advice"] = f"Release the brake progressively and carry more speed into {corner}."
    elif diagnosis == "LOW_ENTRY_SPEED":
        fallback["message"] = f"The transmission is synchronized with low entry speed at {corner}."
        fallback["advice"] = f"Carry more speed into {corner} while keeping the car balanced."
    elif diagnosis == "LOW_MIN_SPEED":
        fallback["message"] = f"The transmission is synchronized with minimum-speed loss at {corner}."
        fallback["advice"] = f"Prioritize rotation and maintain momentum through {corner}."
    elif diagnosis == "LATE_THROTTLE":
        fallback["message"] = f"The transmission is synchronized with late throttle at {corner}."
        fallback["advice"] = f"Start the throttle phase earlier on the exit of {corner}."
    elif diagnosis == "LOW_EXIT_SPEED":
        fallback["message"] = f"The transmission is synchronized with exit-speed loss at {corner}."
        fallback["advice"] = f"Prioritize a clean exit and earlier acceleration from {corner}."

    if not transcript:
        return fallback

    system_prompt = """You are an F1 race engineer interpreting already-extracted evidence.
Hugging Face has already produced the transcript and vocal-state labels. Do not analyze raw audio.
Use only the supplied transcript, voice fields, telemetry, corner, phase, and race context.
Do not claim that emotion proves stress, fatigue, or a psychological state. Say voice state or vocal intensity.
Do not invent values, labels, corners, positions, gaps, diagnoses, or causal relationships.
If a field is null or missing, do not mention it.

CRITICAL RULE FOR STRAIGHTS:
If the current track section is a Straight, do NOT invent a corner-specific driving diagnosis (e.g., braking, throttle, entry speed). Treat the radio as STRATEGIC / RACE CONTEXT rather than a CORNER DRIVING DIAGNOSIS. Provide strategic race guidance instead of car-handling instruction if sufficient evidence exists. You must explicitly include the exact phrase 'Strategic/Race Context' in your message.

Return ONLY valid JSON with exactly:
{"message":"short observation","advice":"short actionable instruction"}
"""
    user_payload = {
        "transcript": transcript,
        "voice": voice,
        "corner": corner,
        "phase": context.get("phase"),
        "performance": performance,
        "race_context": race_context,
    }
    
    corner_diagnosis = "NONE" if is_straight else performance.get("diagnosis")
    
    data = {
        "model": os.getenv("OLLAMA_MODEL", "llama3:latest"),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps({**user_payload, "current_track_section": corner, "corner_diagnosis": corner_diagnosis})},
        ],
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.2},
    }
    url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result.get("message", {}).get("content", "{}").strip()
            if content.startswith("```"):
                content = content.split("```json")[-1].split("```")[0].strip()
            parsed = json.loads(content)
            message = parsed.get("message")
            advice = parsed.get("advice")
            if not isinstance(message, str) or not isinstance(advice, str) or not message or not advice:
                return fallback
            return {"message": message, "advice": advice, "status": "READY"}
    except urllib.error.HTTPError as exc:
        print(f"Voice Ollama interpretation unavailable: {exc}")
        print(f"Response body: {exc.read().decode('utf-8', errors='ignore')}")
        return fallback
    except Exception as exc:
        print(f"Voice Ollama interpretation unavailable: {exc}")
        return fallback


def generate_lap_coaching_advice(payload: dict, fallback: dict) -> dict:
    """Generate one coaching instruction from one completed-lap comparison."""
    system_prompt = """You are an F1 race engineer coaching one completed lap.
The deterministic comparison engine supplied all telemetry facts. Use only those facts.
Do not invent or alter driver numbers, lap times, corner names, diagnoses, deltas, confidence, or benchmark strengths.
Do not mention data that is null or absent. This is a coaching record, not an automatic radio decision.
Return ONLY valid JSON with exactly:
{"message":"one concise evidence-based observation","advice":"one concise next-lap instruction"}
"""
    data = {
        "model": os.getenv("OLLAMA_MODEL", "llama3:latest"),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(payload)},
        ],
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.2},
    }
    url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result.get("message", {}).get("content", "{}").strip()
            if content.startswith("```"):
                content = content.split("```json")[-1].split("```")[0].strip()
            parsed = json.loads(content)
            message = parsed.get("message")
            advice = parsed.get("advice")
            if isinstance(message, str) and isinstance(advice, str) and message and advice:
                return {"message": message, "advice": advice, "status": "READY"}
    except Exception as exc:
        print(f"Lap coaching Ollama interpretation unavailable: {exc}")
    return fallback
