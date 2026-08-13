import os
import json
import urllib.request

def generate_race_engineer_advice(corner_metrics: dict) -> dict:
    """
    Takes a dictionary of deterministic corner metrics.
    Calls the LLM to generate natural race-engineer advice.
    Returns a dictionary mapping corner names to dicts containing 'message' and 'advice'.
    """
    model = "llama3.1:latest"

    url = "http://localhost:11434/api/chat"
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
        with urllib.request.urlopen(req, timeout=15) as response:
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
