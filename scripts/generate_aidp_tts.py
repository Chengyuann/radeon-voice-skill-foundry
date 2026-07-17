#!/usr/bin/env python3
"""Generate scene narration with the configured AIDP Gemini TTS endpoint."""

from __future__ import annotations

import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NARRATION = ROOT / "submission" / "DEMO_NARRATION.md"
OUTPUT = ROOT / "tmp" / "tts-v2"
MODEL = "gemini-3.1-flash-tts-preview"
VOICE = "Kore"
ENDPOINT = "https://aidp.bytedance.net/api/modelhub/online/multimodal/crawl"

SCENE_ORDER = [
    "Speak the SOP. Prove the Skill.",
    "Real Radeon Runtime",
    "Source-Bound Voice Evidence",
    "Local RAG and Skill Compilation",
    "Adversarial Verification",
    "Proof and Procedural Memory",
    "Final Artifact",
]

VOICE_DIRECTION = (
    "Narrate this premium technical product demo in a warm, composed, "
    "confident documentary voice. Use natural conversational rhythm, measured "
    "pacing, crisp articulation, subtle energy, and short intentional pauses. "
    "Avoid robotic cadence, exaggerated advertising tone, and sing-song "
    "delivery. Keep technical numbers clear without sounding like a list. "
    "Pronounce Radeon as ray-dee-on, ROCm as rock-em, Qwen as kwen, and ASR as "
    "A-S-R."
)


def parse_sections() -> dict[str, str]:
    text = NARRATION.read_text(encoding="utf-8")
    matches = list(re.finditer(r"^## (.+)$", text, flags=re.MULTILINE))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[match.group(1).strip()] = re.sub(
            r"\s+", " ", text[start:end]
        ).strip()
    return sections


def generate(ak: str, text: str) -> bytes:
    payload = {
        "model": MODEL,
        "input": {"prompt": VOICE_DIRECTION, "text": text},
        "voice": {
            "languageCode": "en-us",
            "name": VOICE,
            "modelName": MODEL,
        },
        "audioConfig": {"audioEncoding": "MP3"},
    }
    request = urllib.request.Request(
        f"{ENDPOINT}?ak={ak}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    result = None
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(request, timeout=240) as response:
                result = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 4:
                raise
            time.sleep(10 * attempt)
    if result is None:
        raise RuntimeError("AIDP TTS request did not return a result")
    audio = result.get("audioContent")
    if not isinstance(audio, str):
        raise RuntimeError("AIDP TTS response did not contain audioContent")
    return base64.b64decode(audio)


def main() -> None:
    ak = os.environ.get("AIDP_TTS_AK")
    if not ak:
        raise SystemExit("Set AIDP_TTS_AK in the runtime environment")
    sections = parse_sections()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for index, title in enumerate(SCENE_ORDER, start=1):
        audio = generate(ak, sections[title])
        path = OUTPUT / f"scene-{index:02d}.mp3"
        path.write_bytes(audio)
        print(path)
        if index < len(SCENE_ORDER):
            time.sleep(6)


if __name__ == "__main__":
    main()
