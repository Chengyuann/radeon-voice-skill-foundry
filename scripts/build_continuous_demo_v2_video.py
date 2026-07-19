#!/usr/bin/env python3
"""Build the narrated isolated W7900 lifecycle Demo V2."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tmp" / "continuous-demo-v2" / "recording" / "continuous-demo-v2-raw.webm"
EVENTS = ROOT / "tmp" / "continuous-demo-v2" / "recording" / "events.json"
AUDIO_DIR = ROOT / "tmp" / "continuous-demo-v2" / "narration"
WORK = ROOT / "tmp" / "continuous-demo-v2" / "build"
OUTPUT = ROOT / "submission" / "CONTINUOUS_OPERATION_DEMO_V2.mp4"
SRT = ROOT / "submission" / "CONTINUOUS_OPERATION_DEMO_V2.srt"
SOURCE = ROOT / "submission" / "CONTINUOUS_DEMO_V2_NARRATION.md"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
TITLES = [
    "Open the Isolated W7900 Session",
    "Upload the Spoken SOP",
    "Compile Voice into Policy",
    "Verify the Unsafe Paths",
    "Save and Reuse the Skill",
    "Restart and Recover Durable State",
    "Drift the Runtime and Invalidate Proof",
    "Revalidate and Download the Child Proof",
]


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


def wrap(draw: ImageDraw.ImageDraw, text: str, typeface, width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=typeface) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def caption_card(text: str, index: int) -> Path:
    width, height = 1680, 136
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (0, 0, width - 1, height - 1),
        radius=16,
        fill=(19, 21, 23, 226),
        outline=(255, 255, 255, 48),
        width=2,
    )
    typeface = ImageFont.truetype(FONT_BOLD, 30)
    lines = wrap(draw, text, typeface, width - 100)
    if len(lines) > 2:
        typeface = ImageFont.truetype(FONT_BOLD, 25)
        lines = wrap(draw, text, typeface, width - 100)
    line_height = typeface.size + 8
    y = (height - len(lines) * line_height) // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=typeface)
        draw.text(
            ((width - (bbox[2] - bbox[0])) // 2, y),
            line,
            font=typeface,
            fill="white",
        )
        y += line_height
    path = WORK / f"caption-{index:03d}.png"
    image.save(path, optimize=True)
    return path


def narration_sections() -> dict[str, str]:
    text = SOURCE.read_text(encoding="utf-8")
    matches = list(re.finditer(r"^## (.+)$", text, flags=re.MULTILINE))
    result: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        result[match.group(1)] = re.sub(
            r"\s+", " ", text[match.end() : end]
        ).strip()
    return result


def sentences(text: str) -> list[str]:
    return [
        part.strip()
        for part in re.split(r"(?<=[.!?])\s+", text)
        if part.strip()
    ]


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    events = json.loads(EVENTS.read_text(encoding="utf-8"))
    narration = narration_sections()
    raw_duration = duration(RAW)
    audio_inputs = [
        AUDIO_DIR / f"step-{index:02d}.mp3" for index in range(1, 9)
    ]

    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(RAW)]
    for audio in audio_inputs:
        command.extend(["-i", str(audio)])
    filters: list[str] = []
    labels: list[str] = []
    for index, (event, audio) in enumerate(zip(events, audio_inputs), start=1):
        delay = event["startMs"] + 300
        label = f"a{index}"
        filters.append(
            f"[{index}:a]adelay={delay}|{delay},"
            f"volume=1.0,apad=pad_dur={raw_duration:.3f}[{label}]"
        )
        labels.append(f"[{label}]")
    filters.append(
        f"{''.join(labels)}amix=inputs={len(labels)}:"
        "duration=longest:normalize=0,"
        "loudnorm=I=-16:LRA=7:TP=-1.5[mixed]"
    )
    mixed = WORK / "mixed.mp4"
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
            "192k",
            "-ar",
            "44100",
            "-movflags",
            "+faststart",
            str(mixed),
        ]
    )
    run(command)

    caption_entries: list[tuple[float, float, str]] = []
    for event, audio, title in zip(events, audio_inputs, TITLES):
        parts = sentences(narration[title])
        weights = [max(1, len(part.split())) for part in parts]
        total_weight = sum(weights)
        start = event["startMs"] / 1000 + 0.3
        usable = min(
            duration(audio),
            max(0.5, event["endMs"] / 1000 - start - 0.1),
        )
        cursor = start
        for part, weight in zip(parts, weights):
            part_duration = usable * weight / total_weight
            end = min(raw_duration - 0.05, cursor + part_duration)
            caption_entries.append((cursor, end, part))
            cursor = end

    rows: list[str] = []
    for index, (start, end, text) in enumerate(caption_entries, start=1):
        rows.extend(
            [
                str(index),
                f"{srt_time(start)} --> {srt_time(end)}",
                text,
                "",
            ]
        )
    SRT.write_text("\n".join(rows), encoding="utf-8")

    inputs: list[str] = []
    overlay_filters: list[str] = []
    previous = "0:v"
    for index, (start, end, text) in enumerate(caption_entries, start=1):
        card = caption_card(text, index)
        inputs.extend(["-loop", "1", "-i", str(card)])
        output = f"v{index}"
        overlay_filters.append(
            f"[{previous}][{index}:v]overlay=(W-w)/2:H-h-24:"
            f"enable='between(t,{start:.3f},{end:.3f})'[{output}]"
        )
        previous = output

    hard_captioned = WORK / "hard-captioned.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(mixed),
            *inputs,
            "-filter_complex",
            ";".join(overlay_filters),
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
            str(hard_captioned),
        ]
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(hard_captioned),
            "-i",
            str(SRT),
            "-map",
            "0:v",
            "-map",
            "0:a",
            "-map",
            "1:0",
            "-c:v",
            "copy",
            "-c:a",
            "copy",
            "-c:s",
            "mov_text",
            "-metadata:s:s:0",
            "language=eng",
            "-metadata:s:s:0",
            "title=English narration",
            "-disposition:s:0",
            "0",
            "-movflags",
            "+faststart",
            str(OUTPUT),
        ]
    )
    print(OUTPUT)
    print(f"duration={duration(OUTPUT):.3f}s")


if __name__ == "__main__":
    main()
