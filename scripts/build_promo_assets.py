#!/usr/bin/env python3
"""Compose exact project typography over GPT Image 2 background artwork."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output" / "imagegen"
DEST = ROOT / "submission"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"

WHITE = "#FFFFFF"
INK = "#202224"
MUTED = "#C9CED1"
RED = "#C23A35"
GREEN = "#4FA477"
BLUE = "#5B8CA6"


def font(size: int, *, bold: bool = False, mono: bool = False):
    path = FONT_MONO if mono else FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(path, size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), size, Image.Resampling.LANCZOS)


def shade(
    image: Image.Image,
    box: tuple[int, int, int, int],
    opacity: int,
) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rectangle(box, fill=(15, 17, 18, opacity))
    image.alpha_composite(overlay)


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, color: str):
    x, y = xy
    typeface = font(24, bold=True, mono=True)
    width = round(draw.textlength(text, font=typeface)) + 34
    draw.rounded_rectangle((x, y, x + width, y + 44), radius=10, fill=color)
    draw.text((x + 17, y + 10), text, font=typeface, fill=WHITE)


def stat(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    name: str,
    color: str,
) -> None:
    x, y = xy
    draw.text((x, y), value, font=font(48, bold=True), fill=color)
    draw.text((x, y + 58), name, font=font(19, bold=True, mono=True), fill=MUTED)


def video_cover() -> Path:
    source = Image.open(SOURCE / "rvsf-cover-background-v2.png")
    image = cover(source, (1920, 1080)).convert("RGBA")
    shade(image, (0, 0, 1110, 1080), 164)
    draw = ImageDraw.Draw(image)
    label(draw, (82, 70), "AMD AI DEVMASTER | TRACK 2", RED)
    draw.text((82, 176), "Radeon Voice", font=font(86, bold=True), fill=WHITE)
    draw.text((82, 268), "Skill Foundry", font=font(86, bold=True), fill=WHITE)
    draw.text(
        (86, 382),
        "Speak the SOP. Prove the Skill.",
        font=font(34, bold=True),
        fill="#E6EAEC",
    )
    draw.line((86, 458, 850, 458), fill=(255, 255, 255, 80), width=2)
    draw.text(
        (86, 500),
        "Private voice becomes a governed Agent Skill",
        font=font(30),
        fill=WHITE,
    )
    draw.text(
        (86, 548),
        "with permissions, adversarial tests, receipts and proof.",
        font=font(30),
        fill=WHITE,
    )
    stat(draw, (86, 720), "100/100", "VOICE EVIDENCE", GREEN)
    stat(draw, (390, 720), "7/7", "RADEON PROOF", GREEN)
    stat(draw, (610, 720), "DENY", "MAIL.SEND", RED)
    draw.text(
        (86, 956),
        "Qwen3-ASR + Qwen3-4B | ROCm 7.2.1 | W7900-class",
        font=font(22, mono=True),
        fill=MUTED,
    )
    path = DEST / "VIDEO_COVER_V2.png"
    image.convert("RGB").save(path, optimize=True)
    return path


def campaign_banner() -> Path:
    source = Image.open(SOURCE / "rvsf-campaign-background-v2.png")
    image = cover(source, (1920, 1080)).convert("RGBA")
    shade(image, (0, 0, 1920, 1080), 90)
    shade(image, (0, 0, 760, 1080), 126)
    draw = ImageDraw.Draw(image)
    label(draw, (72, 64), "VOICE -> POLICY -> PROOF", BLUE)
    draw.text((72, 158), "Radeon Voice", font=font(72, bold=True), fill=WHITE)
    draw.text((72, 235), "Skill Foundry", font=font(72, bold=True), fill=WHITE)
    steps = [
        ("01", "Measure the source", "level, clipping, silence and hashes"),
        ("02", "Compile the intent", "typed rules and minimum permissions"),
        ("03", "Prove the skill", "7 adversarial fixtures and receipts"),
    ]
    y = 392
    for number, title, detail in steps:
        draw.text((76, y), number, font=font(24, bold=True, mono=True), fill=RED)
        draw.text((142, y - 5), title, font=font(30, bold=True), fill=WHITE)
        draw.text((142, y + 39), detail, font=font(21), fill=MUTED)
        y += 132
    draw.rounded_rectangle(
        (72, 836, 716, 984),
        radius=16,
        fill=(20, 22, 24, 215),
        outline=(255, 255, 255, 42),
        width=2,
    )
    draw.text((104, 862), "FINAL RADEON VALIDATION", font=font(20, bold=True, mono=True), fill=GREEN)
    draw.text((104, 904), "21/21 tests  |  7/7 proof  |  mail.send DENY", font=font(24, bold=True), fill=WHITE)
    path = DEST / "PROMO_BANNER_V2.png"
    image.convert("RGB").save(path, optimize=True)
    return path


def social_card() -> Path:
    source = Image.open(SOURCE / "rvsf-social-background-v2.png")
    image = cover(source, (1200, 1200)).convert("RGBA")
    shade(image, (0, 0, 1200, 1200), 92)
    shade(image, (0, 0, 1200, 500), 110)
    draw = ImageDraw.Draw(image)
    label(draw, (64, 58), "LOCAL AGENT | PROOF-CARRYING SKILL", RED)
    draw.text((64, 146), "Radeon Voice", font=font(68, bold=True), fill=WHITE)
    draw.text((64, 220), "Skill Foundry", font=font(68, bold=True), fill=WHITE)
    draw.text((66, 310), "Speak the SOP. Prove the Skill.", font=font(29, bold=True), fill=MUTED)
    draw.rounded_rectangle(
        (60, 830, 1140, 1115),
        radius=24,
        fill=(17, 19, 21, 224),
        outline=(255, 255, 255, 45),
        width=2,
    )
    stat(draw, (104, 874), "100/100", "VOICE EVIDENCE", GREEN)
    stat(draw, (470, 874), "7/7", "RADEON PROOF", GREEN)
    stat(draw, (760, 874), "DENY", "MAIL.SEND", RED)
    draw.text((104, 1048), "Voice -> Policy -> Proof", font=font(25, bold=True, mono=True), fill=BLUE)
    path = DEST / "SOCIAL_CARD_V2.png"
    image.convert("RGB").save(path, optimize=True)
    return path


if __name__ == "__main__":
    for output in [video_cover(), campaign_banner(), social_card()]:
        print(output)
