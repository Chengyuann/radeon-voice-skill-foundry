#!/usr/bin/env python3
"""Append the audited terminology boundary card to Demo V3."""

from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tmp" / "demo-v3" / "build" / "hard-captioned.mp4"
OUTPUT = ROOT / "submission" / "RADEON_VOICE_SKILL_FOUNDRY_DEMO_V3.mp4"
SRT = ROOT / "submission" / "RADEON_VOICE_SKILL_FOUNDRY_DEMO_V3.srt"
WORK = ROOT / "tmp" / "demo-v3" / "terminology-card"
FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
CARD_DURATION = 10


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size=size)


def wrap(
    draw: ImageDraw.ImageDraw,
    text: str,
    typeface: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=typeface) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def build_card() -> Path:
    image = Image.new("RGB", (1920, 1080), "#202224")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 18, 1080), fill="#C23A35")
    draw.text(
        (150, 120),
        "TERMINOLOGY BOUNDARY",
        font=font(28, bold=True),
        fill="#F4B6B2",
    )
    draw.text(
        (150, 180),
        "How to read the earlier narration",
        font=font(56, bold=True),
        fill="#FFFFFF",
    )

    bullets = [
        (
            "Agent Skill Markdown",
            "SKILL.md is portable Agent Skill Markdown. "
            "\"GAIA-compatible\" in the narration is package-format shorthand; "
            "no external GAIA conformance is claimed.",
        ),
        (
            "Proof hash",
            "\"Proof-bound\" means promotion checks the current SHA-256 proof hash.",
        ),
        (
            "Ledger boundary",
            "The ledger is hash-chained local integrity evidence. "
            "It is not digitally signed or externally anchored.",
        ),
    ]

    y = 330
    for title, body in bullets:
        draw.ellipse((150, y + 8, 174, y + 32), fill="#7FB99B")
        draw.text((205, y), title, font=font(32, bold=True), fill="#FFFFFF")
        body_font = font(27)
        lines = wrap(draw, body, body_font, 1460)
        line_y = y + 52
        for line in lines:
            draw.text((205, line_y), line, font=body_font, fill="#D8DCDE")
            line_y += 39
        y = line_y + 58

    draw.text(
        (150, 990),
        "Full threat and evidence boundaries: Project Specification and Scoring Evidence Matrix",
        font=font(22),
        fill="#AEB4B7",
    )

    path = WORK / "terminology-card.png"
    image.save(path, optimize=True)
    return path


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    card = build_card()
    segment = WORK / "terminology-card.mp4"
    joined = WORK / "demo-v3-with-card.mp4"
    final = WORK / "demo-v3-with-card-and-subs.mp4"

    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-loop",
            "1",
            "-i",
            str(card),
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=mono:sample_rate=44100",
            "-t",
            str(CARD_DURATION),
            "-r",
            "25",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
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
            str(segment),
        ]
    )

    concat_list = WORK / "concat.txt"
    concat_list.write_text(
        f"file '{SOURCE}'\nfile '{segment}'\n", encoding="utf-8"
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-map",
            "0:v",
            "-map",
            "0:a",
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(joined),
        ]
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(joined),
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
            str(final),
        ]
    )
    final.replace(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
