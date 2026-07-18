#!/usr/bin/env python3
"""Generate step-level AIDP narration for the continuous browser demo."""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "submission" / "CONTINUOUS_DEMO_NARRATION.md"
OUTPUT = ROOT / "tmp" / "continuous-narration"
MODEL = "gemini-3.1-flash-tts-preview"
VOICE = os.environ.get("AIDP_TTS_VOICE", "Charon")
ENDPOINT = "https://aidp.bytedance.net/api/modelhub/online/multimodal/crawl"

TITLES = [
    "Open the Workbench",
    "Upload the Spoken SOP",
    "Compile Voice into Policy",
    "Run Adversarial Verification",
    "Save and Reuse the Verified Skill",
    "Restart and Recover Durable Runs",
    "Change Runtime and Invalidate Proof",
    "Revalidate and Download Proof",
]

DIRECTION = (
    "Use an adult male technical documentary voice with a natural lower "
    "register. Narrate this continuous product demonstration in a calm, "
    "credible, quietly confident manner. Use conversational rhythm and concise "
    "pauses. Keep enough energy to match visible mouse actions, but never sound "
    "like an advertisement or a list. Read the supplied text exactly once and "
    "stop after the final sentence. Do not repeat, improvise, or add an outro. "
    "Pronounce Radeon as ray-dee-on, ROCm as rock-em, Qwen as kwen, ASR as "
    "A-S-R, and P0 and P1 as P-zero and P-one."
)


def sections() -> dict[str, str]:
    text = SOURCE.read_text(encoding="utf-8")
    matches = list(re.finditer(r"^## (.+)$", text, flags=re.MULTILINE))
    result = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        result[match.group(1)] = re.sub(r"\s+", " ", text[match.end() : end]).strip()
    return result


def generate(ak: str, text: str) -> bytes:
    payload = {
        "model": MODEL,
        "input": {"prompt": DIRECTION, "text": text},
        "voice": {
            "languageCode": "en-us",
            "name": VOICE,
            "modelName": MODEL,
        },
        "audioConfig": {"audioEncoding": "MP3"},
    }
    request = urllib.request.Request(
        f"{ENDPOINT}?ak={ak}",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(request, timeout=240) as response:
                result = json.loads(response.read().decode())
            return base64.b64decode(result["audioContent"])
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            time.sleep(attempt * 10)
    raise RuntimeError("TTS generation failed")


def duration(path: Path) -> float:
    return float(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
        ).strip()
    )


def main() -> None:
    ak = os.environ.get("AIDP_TTS_AK")
    if not ak:
        raise SystemExit("Set AIDP_TTS_AK in the runtime environment")
    only_index = int(os.environ.get("AIDP_TTS_ONLY_INDEX", "0"))
    content = sections()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    timings = []
    for index, title in enumerate(TITLES, start=1):
        path = OUTPUT / f"step-{index:02d}.mp3"
        text = content[title]
        if only_index in {0, index}:
            for generation_attempt in range(1, 4):
                path.write_bytes(generate(ak, text))
                audio_duration = duration(path)
                duration_limit = max(45.0, len(text.split()) * 0.9)
                if audio_duration <= duration_limit:
                    break
                if generation_attempt == 3:
                    raise RuntimeError(
                        f"Step {index} narration duration {audio_duration:.3f}s "
                        f"exceeds {duration_limit:.3f}s"
                    )
                time.sleep(8)
        elif not path.exists():
            raise RuntimeError(f"Missing existing narration: {path}")
        audio_duration = duration(path)
        timings.append({"index": index, "title": title, "duration": audio_duration})
        print(path)
        if only_index == 0 and index < len(TITLES):
            time.sleep(6)
    (OUTPUT / "timings.json").write_text(
        json.dumps(timings, indent=2), encoding="utf-8"
    )
    print(f"total={sum(item['duration'] for item in timings):.3f}s")


if __name__ == "__main__":
    main()
