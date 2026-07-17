#!/usr/bin/env python3
"""Mix step narration into the single-take continuous browser recording."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tmp" / "continuous-demo" / "continuous-demo-raw.webm"
EVENTS = ROOT / "tmp" / "continuous-demo" / "events.json"
AUDIO_DIR = ROOT / "tmp" / "continuous-narration"
WORK = ROOT / "tmp" / "continuous-demo" / "build"
OUTPUT = ROOT / "submission" / "CONTINUOUS_OPERATION_DEMO.mp4"
SRT = ROOT / "submission" / "CONTINUOUS_OPERATION_DEMO.srt"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


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


def srt_time(value: float) -> str:
    milliseconds = round(value * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def caption_card(text: str, index: int) -> Path:
    width, height = 1300, 92
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (0, 0, width - 1, height - 1),
        radius=14,
        fill=(20, 22, 24, 222),
        outline=(255, 255, 255, 48),
        width=2,
    )
    typeface = ImageFont.truetype(FONT_BOLD, 29)
    bbox = draw.textbbox((0, 0), text, font=typeface)
    draw.text(
        ((width - (bbox[2] - bbox[0])) // 2, 27),
        text,
        font=typeface,
        fill="white",
    )
    path = WORK / f"caption-{index:02d}.png"
    image.save(path, optimize=True)
    return path


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    events = json.loads(EVENTS.read_text())
    raw_duration = duration(RAW)
    audio_inputs = [AUDIO_DIR / f"step-{index:02d}.mp3" for index in range(1, 9)]

    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(RAW)]
    for audio in audio_inputs:
        command.extend(["-i", str(audio)])

    filters: list[str] = []
    audio_labels: list[str] = []
    for index, (event, audio) in enumerate(zip(events, audio_inputs), start=1):
        delay = max(0, event["startMs"] + 250)
        label = f"a{index}"
        filters.append(
            f"[{index}:a]adelay={delay}|{delay},"
            f"volume=1.25,apad=pad_dur={raw_duration:.3f}[{label}]"
        )
        audio_labels.append(f"[{label}]")
    filters.append(
        f"{''.join(audio_labels)}amix=inputs={len(audio_labels)}:"
        f"duration=longest:normalize=0,alimiter=limit=0.95[mixed]"
    )

    command.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "0:v",
            "-map",
            "[mixed]",
            "-t",
            f"{raw_duration:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-ar",
            "44100",
            "-movflags",
            "+faststart",
            str(WORK / "mixed.mp4"),
        ]
    )
    run(command)

    caption_inputs = []
    caption_filters = []
    previous = "0:v"
    srt_rows = []
    for index, event in enumerate(events, start=1):
        title = event["label"]
        card = caption_card(title, index)
        caption_inputs.extend(["-loop", "1", "-i", str(card)])
        start = event["startMs"] / 1000
        end = event["endMs"] / 1000
        output = f"v{index}"
        caption_filters.append(
            f"[{previous}][{index}:v]overlay=(W-w)/2:H-h-22:"
            f"enable='between(t,{start:.3f},{end:.3f})'[{output}]"
        )
        previous = output
        srt_rows.extend(
            [
                str(index),
                f"{srt_time(start)} --> {srt_time(end)}",
                title,
                "",
            ]
        )

    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(WORK / "mixed.mp4"),
            *caption_inputs,
            "-filter_complex",
            ";".join(caption_filters),
            "-map",
            f"[{previous}]",
            "-map",
            "0:a",
            "-t",
            f"{raw_duration:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "copy",
            "-movflags",
            "+faststart",
            str(OUTPUT),
        ]
    )
    SRT.write_text("\n".join(srt_rows), encoding="utf-8")
    print(OUTPUT)
    print(f"duration={duration(OUTPUT):.3f}s")


if __name__ == "__main__":
    main()
