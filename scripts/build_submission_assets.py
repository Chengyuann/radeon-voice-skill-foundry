#!/usr/bin/env python3
"""Build architecture, poster, and project specification PDF assets."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import (
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "submission"
TMP = ROOT / "tmp" / "submission-assets"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_ITALIC = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"

INK = "#202224"
MUTED = "#6E7377"
LINE = "#D9DDDF"
SURFACE = "#F8F9F9"
WHITE = "#FFFFFF"
ACCENT = "#C23A35"
ACCENT_DARK = "#942C28"
GREEN = "#2F6A4F"
GREEN_BG = "#E6F1EB"
BLUE = "#345F78"
BLUE_BG = "#E4EEF3"
AMBER = "#7F5A23"
AMBER_BG = "#F4ECDA"
BG = "#EEF0F1"


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_MONO if mono else (FONT_BOLD if bold else FONT_REGULAR)
    return ImageFont.truetype(path, size=size)


def rounded_box(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: str,
    outline: str = LINE,
    radius: int = 18,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    typeface: ImageFont.FreeTypeFont,
    max_width: int,
) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=typeface) <= max_width:
            current = candidate
        elif current:
            lines.append(current)
            current = word
        else:
            lines.append(word)
            current = ""
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    typeface: ImageFont.FreeTypeFont,
    fill: str,
    max_width: int,
    line_gap: int = 8,
) -> int:
    x, y = xy
    lines = wrap_text(draw, text, typeface, max_width)
    line_height = typeface.size + line_gap
    for line in lines:
        draw.text((x, y), line, font=typeface, fill=fill)
        y += line_height
    return y


def arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    color: str = "#A7ADB0",
    width: int = 5,
) -> None:
    draw.line([start, end], fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    length = 18
    spread = 0.55
    p1 = (
        end[0] - length * math.cos(angle - spread),
        end[1] - length * math.sin(angle - spread),
    )
    p2 = (
        end[0] - length * math.cos(angle + spread),
        end[1] - length * math.sin(angle + spread),
    )
    draw.polygon([end, p1, p2], fill=color)


def build_architecture() -> Path:
    width, height = 2400, 1420
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)

    draw.text((120, 78), "Radeon Voice Skill Foundry", font=font(62, bold=True), fill=INK)
    draw.text(
        (120, 154),
        "Cloudflare product -> authenticated W7900 inference -> verified skill package",
        font=font(30),
        fill=MUTED,
    )

    entry_boxes = [
        (
            (100, 300, 490, 555),
            "PUBLIC PRODUCT",
            "Cloudflare Pages",
            "Cinematic module UI\nVoice -> Policy -> Proof -> Memory",
            BLUE_BG,
            BLUE,
        ),
        (
            (585, 300, 975, 555),
            "SAME-ORIGIN /api",
            "Authenticated Gateway",
            "Server-held token\nDirect origin requests rejected",
            AMBER_BG,
            AMBER,
        ),
    ]
    for rect, eyebrow, title, body, fill, accent in entry_boxes:
        rounded_box(draw, rect, fill, outline=accent, radius=22, width=3)
        x1, y1, _, _ = rect
        draw.text((x1 + 28, y1 + 28), eyebrow, font=font(20, bold=True, mono=True), fill=accent)
        draw.text((x1 + 28, y1 + 76), title, font=font(29, bold=True), fill=INK)
        for idx, line in enumerate(body.splitlines()):
            draw.text((x1 + 28, y1 + 132 + idx * 38), line, font=font(22), fill=MUTED)

    arrow(draw, (490, 428), (585, 428), color=BLUE)

    gpu_box = (1070, 250, 2300, 650)
    rounded_box(draw, gpu_box, WHITE, ACCENT, radius=26, width=4)
    draw.text((1110, 278), "AMD RADEON GPU + ROCm 7.2.1", font=font(27, bold=True), fill=ACCENT_DARK)
    draw.text(
        (1110, 320),
        "W7900-class | gfx1100 | Qwen3 FP16 inference",
        font=font(22),
        fill=MUTED,
    )
    inference_boxes = [
        (
            (1110, 375, 1630, 610),
            "LOCAL SPEECH",
            "Qwen3-ASR-0.6B",
            "Voice transcript + timing\n85.35x aggregate RT at batch 8",
        ),
        (
            (1740, 375, 2260, 610),
            "AGENT COMPILER",
            "Qwen3-4B-Instruct",
            "Typed constraints + procedure\n257.65 tok/s at concurrency 8",
        ),
    ]
    for rect, eyebrow, title, body in inference_boxes:
        rounded_box(draw, rect, "#FBEAE8", outline=ACCENT_DARK, radius=20, width=3)
        x1, y1, _, _ = rect
        draw.text((x1 + 26, y1 + 25), eyebrow, font=font(19, bold=True, mono=True), fill=ACCENT_DARK)
        draw.text((x1 + 26, y1 + 68), title, font=font(29, bold=True), fill=INK)
        for idx, line in enumerate(body.splitlines()):
            draw.text((x1 + 26, y1 + 121 + idx * 36), line, font=font(21), fill=MUTED)

    arrow(draw, (975, 428), (1110, 428), color=ACCENT)
    arrow(draw, (1630, 500), (1740, 500), color=ACCENT)

    layer_y = 745
    layer_w = 390
    layer_gap = 55
    layers = [
        ("VOICE EVIDENCE", "Source-bound Gate", "PASS / REVIEW / QUARANTINE", AMBER_BG, AMBER),
        ("LOCAL CONTEXT", "Policy / SOP Retrieval", "Deterministic token-overlap evidence", BLUE_BG, BLUE),
        ("SAFETY KERNEL", "Least Privilege", "deny / review / redact / confirm", AMBER_BG, AMBER),
        ("VERIFICATION", "Adversarial Replay", "7/7 + hashed receipts", GREEN_BG, GREEN),
        ("PROCEDURAL MEMORY", "Verified Skill", "2.18 ms exact reuse", WHITE, GREEN),
    ]
    layer_rects: list[tuple[int, int, int, int]] = []
    for idx, (eyebrow, title, body, fill, accent) in enumerate(layers):
        x1 = 100 + idx * (layer_w + layer_gap)
        rect = (x1, layer_y, x1 + layer_w, layer_y + 225)
        layer_rects.append(rect)
        rounded_box(draw, rect, fill, outline=accent, radius=22, width=3)
        draw.text((x1 + 25, layer_y + 25), eyebrow, font=font(17, bold=True, mono=True), fill=accent)
        draw.text((x1 + 25, layer_y + 68), title, font=font(27, bold=True), fill=INK)
        draw_wrapped(draw, (x1 + 25, layer_y + 120), body, font(20), MUTED, layer_w - 50, 7)
        if idx:
            previous = layer_rects[idx - 1]
            arrow(
                draw,
                (previous[2], layer_y + 112),
                (rect[0], layer_y + 112),
                color=GREEN if idx >= 3 else BLUE,
                width=4,
            )

    arrow(draw, (1320, 650), (295, layer_y), color=AMBER, width=4)
    arrow(draw, (2000, 650), (740, layer_y), color=BLUE, width=4)
    arrow(draw, (2145, 650), (1185, layer_y), color=ACCENT, width=4)

    lifecycle = (100, 1085, 2300, 1305)
    rounded_box(draw, lifecycle, INK, outline=INK, radius=24, width=2)
    draw.text((140, 1120), "DURABLE PROOF LIFECYCLE", font=font(20, bold=True, mono=True), fill="#B9E1CC")
    lifecycle_steps = [
        ("Atomic store", "voice + compile + verification"),
        ("Restart", "trusted records recover"),
        ("Runtime drift", "reuse is invalidated"),
        ("Revalidate", "child proof + parentRunId"),
    ]
    for idx, (title, body) in enumerate(lifecycle_steps):
        x = 140 + idx * 545
        draw.text((x, 1170), title, font=font(27, bold=True), fill=WHITE)
        draw.text((x, 1214), body, font=font(19), fill="#D8DCDE")
        if idx < len(lifecycle_steps) - 1:
            arrow(draw, (x + 420, 1200), (x + 505, 1200), color="#7FB99B", width=4)

    draw.text(
        (120, 1352),
        "The Product Demo records the public W7900 workflow. Supporting evidence separates performance and lifecycle controls.",
        font=font(25, bold=True),
        fill=INK,
    )

    path = SUBMISSION / "ARCHITECTURE.png"
    image.save(path, quality=95)
    return path


def icon_circle(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    radius: int,
    fill: str,
    label: str,
) -> None:
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)
    typeface = font(34, bold=True, mono=True)
    bbox = draw.textbbox((0, 0), label, font=typeface)
    draw.text(
        (x - (bbox[2] - bbox[0]) / 2, y - (bbox[3] - bbox[1]) / 2 - 3),
        label,
        font=typeface,
        fill=WHITE,
    )


def build_cross_modal_policy() -> Path:
    width, height = 2400, 1500
    image = Image.new("RGB", (width, height), "#F1F3F3")
    draw = ImageDraw.Draw(image)

    draw.text(
        (105, 70),
        "Cross-Modal Policy Induction",
        font=font(64, bold=True),
        fill=INK,
    )
    draw.text(
        (108, 150),
        "Speech + Demonstration + Local Policy -> Verified Agent Skill",
        font=font(30, bold=True),
        fill=ACCENT_DARK,
    )
    draw.text(
        (108, 205),
        "Ordinary voice agents stop at speech-to-text-to-chat. This system uses each modality for evidence the others cannot provide.",
        font=font(23),
        fill=MUTED,
    )

    cols = [
        (
            "HEARD",
            "Private speech",
            ["do not send automatically", "owner missing needs confirmation"],
            "why / when / must never happen",
            ACCENT,
            "#FBEAE8",
        ),
        (
            "OBSERVED",
            "Demonstrated actions",
            ["create email draft", "select owner field"],
            "actual tools / parameters / state",
            BLUE,
            BLUE_BG,
        ),
        (
            "RETRIEVED",
            "Local policy evidence",
            ["external send needs approval", "missing owner blocks release"],
            "authority / boundary / citation",
            GREEN,
            GREEN_BG,
        ),
    ]
    top = 320
    card_w = 690
    card_h = 300
    gap = 55
    centers: list[tuple[int, int]] = []
    for idx, (eyebrow, title, bullets, footer, accent, fill) in enumerate(cols):
        x = 105 + idx * (card_w + gap)
        rect = (x, top, x + card_w, top + card_h)
        rounded_box(draw, rect, fill, outline=accent, radius=24, width=4)
        icon_circle(draw, (x + 62, top + 63), 36, accent, str(idx + 1))
        draw.text((x + 118, top + 35), eyebrow, font=font(22, bold=True, mono=True), fill=accent)
        draw.text((x + 118, top + 78), title, font=font(33, bold=True), fill=INK)
        by = top + 143
        for bullet in bullets:
            draw.rounded_rectangle((x + 42, by + 7, x + 64, by + 29), radius=6, fill=accent)
            draw.text((x + 84, by), bullet, font=font(23, bold=True), fill=INK)
            by += 49
        draw.text((x + 42, top + 252), footer, font=font(20, bold=True), fill=MUTED)
        centers.append((x + card_w // 2, top + card_h))

    compiler = (535, 740, 1865, 1015)
    rounded_box(draw, compiler, INK, outline=INK, radius=28, width=2)
    draw.text((595, 778), "POLICY COMPILER", font=font(23, bold=True, mono=True), fill="#B9E1CC")
    draw.text((595, 827), "typed, least-privilege policy", font=font(38, bold=True), fill=WHITE)
    policy_lines = [
        ("mail.draft", "allow", GREEN),
        ("mail.send", "deny", ACCENT),
        ("owner.missing", "requires confirmation", AMBER),
    ]
    px = 595
    py = 900
    for name, value, color in policy_lines:
        draw.rounded_rectangle((px, py, px + 382, py + 70), radius=12, fill="#2B2F31")
        draw.text((px + 18, py + 11), name, font=font(19, bold=True, mono=True), fill="#D7DCDD")
        draw.text((px + 18, py + 40), value, font=font(21, bold=True), fill=color)
        px += 420

    for cx, cy in centers:
        arrow(draw, (cx, cy + 8), (1200, compiler[1] - 8), color="#899197", width=5)

    verified = (150, 1135, 1010, 1360)
    rounded_box(draw, verified, WHITE, outline=GREEN, radius=24, width=4)
    draw.text((195, 1172), "VERIFIED AGENT SKILL", font=font(23, bold=True, mono=True), fill=GREEN)
    draw.text((195, 1222), "proof-bound, reusable, and versioned", font=font(31, bold=True), fill=INK)
    draw.text((195, 1280), "fixtures + receipts + hashes + child-run lineage", font=font(22), fill=MUTED)

    conflict = (1110, 1135, 2250, 1360)
    rounded_box(draw, conflict, "#FBEAE8", outline=ACCENT, radius=24, width=4)
    draw.text((1155, 1172), "CROSS-MODAL CONFLICT CHECK", font=font(23, bold=True, mono=True), fill=ACCENT_DARK)
    draw.text((1155, 1220), "ASR path: mail.send = allow", font=font(25, bold=True, mono=True), fill=ACCENT_DARK)
    draw.text((1155, 1262), "Raw audio critic: mail.send = deny", font=font(25, bold=True, mono=True), fill=INK)
    draw.text((1155, 1310), "Decision: QUARANTINE", font=font(34, bold=True, mono=True), fill=ACCENT)

    arrow(draw, (1200, compiler[3] + 10), (575, verified[1] - 10), color=GREEN, width=5)
    arrow(draw, (1510, compiler[3] + 10), (1680, conflict[1] - 10), color=ACCENT, width=5)

    draw.text(
        (105, 1430),
        "Actions capture what happened. Speech captures why, when, and what must never happen. Local policy supplies authority.",
        font=font(26, bold=True),
        fill=INK,
    )

    path = SUBMISSION / "CROSS_MODAL_POLICY_INDUCTION.png"
    image.save(path, quality=95)
    return path


def draw_metric_tile(
    draw: ImageDraw.ImageDraw,
    rect: tuple[int, int, int, int],
    value: str,
    label: str,
    note: str,
    accent: str,
) -> None:
    x1, y1, x2, y2 = rect
    rounded_box(draw, rect, WHITE, outline="#CCD2D5", radius=18, width=2)
    draw.text((x1 + 24, y1 + 16), value, font=font(42, bold=True), fill=accent)
    draw.text((x1 + 24, y1 + 68), label, font=font(18, bold=True, mono=True), fill=INK)
    draw_wrapped(draw, (x1 + 24, y1 + 94), note, font(16), MUTED, x2 - x1 - 48, 4)


def build_judge_result_card() -> Path:
    width, height = 2400, 1350
    image = Image.new("RGB", (width, height), "#F4F6F7")
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, width, 18), fill=ACCENT)
    draw.text((96, 62), "Radeon Voice Skill Foundry", font=font(42, bold=True), fill=INK)
    draw.text((98, 116), "AMD AI DevMaster Track 2 | Chengyuan Ma", font=font(21, bold=True, mono=True), fill=MUTED)
    draw.text((96, 188), "Cross-Modal Policy Induction", font=font(72, bold=True), fill=INK)
    draw.text(
        (100, 280),
        "Speech explains why. Demonstration proves how. Local policy defines authority.",
        font=font(31, bold=True),
        fill=ACCENT_DARK,
    )
    draw.text(
        (100, 334),
        "Not speech-to-text-to-chat: three non-interchangeable evidence channels become one proof-bound Agent Skill.",
        font=font(23),
        fill=MUTED,
    )

    # Evidence cards.
    evidence = [
        (
            "HEARD",
            "Private speech",
            "why / when / must never happen",
            ["do not send automatically", "owner missing requires confirmation"],
            ACCENT,
            "#FBEAE8",
        ),
        (
            "OBSERVED",
            "Demonstrated actions",
            "tools / order / parameters / state",
            ["create the draft", "select owner and due-date fields"],
            BLUE,
            BLUE_BG,
        ),
        (
            "RETRIEVED",
            "Local policy",
            "authority / boundary / citation",
            ["external send needs approval", "missing owner blocks release"],
            GREEN,
            GREEN_BG,
        ),
    ]
    card_y = 440
    card_w = 540
    card_h = 300
    card_gap = 44
    card_centers: list[tuple[int, int]] = []
    for idx, (eyebrow, title, footer, bullets, accent, fill) in enumerate(evidence):
        x = 96 + idx * (card_w + card_gap)
        rect = (x, card_y, x + card_w, card_y + card_h)
        rounded_box(draw, rect, fill, outline=accent, radius=24, width=4)
        draw.text((x + 30, card_y + 28), eyebrow, font=font(21, bold=True, mono=True), fill=accent)
        draw.text((x + 30, card_y + 70), title, font=font(34, bold=True), fill=INK)
        by = card_y + 136
        for bullet in bullets:
            draw.rounded_rectangle((x + 32, by + 7, x + 54, by + 29), radius=6, fill=accent)
            draw_wrapped(draw, (x + 74, by), bullet, font(20, bold=True), INK, card_w - 110, 4)
            by += 54
        draw.text((x + 30, card_y + 252), footer, font=font(18, bold=True), fill=MUTED)
        card_centers.append((x + card_w // 2, card_y + card_h))

    skill = (635, 845, 1765, 1075)
    rounded_box(draw, skill, INK, outline=INK, radius=26, width=2)
    draw.text((685, 880), "VERIFIED AGENT SKILL", font=font(24, bold=True, mono=True), fill="#B9E1CC")
    draw.text((685, 930), "least-privilege policy + tests + receipts", font=font(38, bold=True), fill=WHITE)
    draw.text(
        (685, 990),
        "portable SKILL.md | 7/7 adversarial replay | versioned memory | explicit promotion",
        font=font(23),
        fill="#D7DCDD",
    )
    for cx, cy in card_centers:
        arrow(draw, (cx, cy + 12), (1200, skill[1] - 12), color="#8A9297", width=5)

    conflict = (1825, 440, 2304, 1075)
    rounded_box(draw, conflict, WHITE, outline=ACCENT, radius=24, width=4)
    draw.text((1860, 478), "FAIL-CLOSED CHECK", font=font(22, bold=True, mono=True), fill=ACCENT_DARK)
    draw.text((1860, 540), "critical", font=font(42, bold=True), fill=INK)
    draw.text((1860, 590), "disagreement", font=font(42, bold=True), fill=INK)
    draw.line((1860, 665, 2265, 665), fill=LINE, width=3)
    draw.text((1860, 706), "ASR + Agent path", font=font(22, bold=True), fill=MUTED)
    draw.text((1860, 744), "mail.send = allow", font=font(24, bold=True, mono=True), fill=ACCENT_DARK)
    draw.text((1860, 808), "Raw-audio critic", font=font(22, bold=True), fill=MUTED)
    draw.text((1860, 846), "mail.send = deny", font=font(24, bold=True, mono=True), fill=GREEN)
    draw.rounded_rectangle((1860, 928, 2265, 1016), radius=16, fill="#FBEAE8", outline=ACCENT, width=3)
    draw.text((1900, 950), "QUARANTINE", font=font(38, bold=True, mono=True), fill=ACCENT)
    draw.text((1860, 1040), "conflicts never grant permission", font=font(19, bold=True), fill=MUTED)
    arrow(draw, (1765, 960), (1825, 960), color=ACCENT, width=5)

    # Bottom result rail.
    rail = (96, 1144, 2304, 1296)
    rounded_box(draw, rail, "#E7EBED", outline="#CCD2D5", radius=22, width=2)
    metrics = [
        ("257.65", "TOK/S", "vLLM graph C8", ACCENT_DARK),
        ("12.47x", "SERVING", "throughput uplift", BLUE),
        ("4.79x", "TOK/J", "GPU package output efficiency", GREEN),
        ("68/68", "TESTS", "typecheck + build + verifier", GREEN),
    ]
    x = 126
    for value, label, note, accent in metrics:
        draw_metric_tile(draw, (x, 1168, x + 500, 1282), value, label, note, accent)
        x += 540

    draw.text(
        (96, 1310),
        "Detailed evidence: CROSS_MODAL_POLICY_INDUCTION.png, AUDIO_NATIVE_POLICY_CRITIC_SUMMARY.json, BOARD_ENERGY_SUMMARY.json, SHA256SUMS.txt",
        font=font(18, bold=True),
        fill=MUTED,
    )

    path = SUBMISSION / "JUDGE_RESULT_CARD.png"
    image.save(path, quality=95)
    return path


def build_poster() -> tuple[Path, Path]:
    width, height = 1800, 2550
    image = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, width, 330), fill=INK)
    draw.rounded_rectangle((110, 92, 210, 192), radius=18, fill=ACCENT)
    draw.text((137, 110), "V", font=font(58, bold=True), fill=WHITE)
    draw.text((250, 78), "Radeon Voice", font=font(76, bold=True), fill=WHITE)
    draw.text((250, 160), "Skill Foundry", font=font(76, bold=True), fill=WHITE)
    draw.text((110, 254), "CROSS-MODAL POLICY INDUCTION", font=font(25, bold=True, mono=True), fill="#D8DCDE")

    draw.text((110, 395), "A local Agent can observe clicks.", font=font(44, bold=True), fill=INK)
    draw.text((110, 455), "It cannot infer the hidden rules.", font=font(44, bold=True), fill=ACCENT_DARK)
    draw_wrapped(
        draw,
        (110, 535),
        "Speech explains why, when, and what must never happen. Demonstrated actions show tools and parameters. Local policy provides authority. The W7900 compiles the three into a least-privilege skill and proves it before promotion.",
        font(27),
        MUTED,
        1580,
        10,
    )

    y = 690
    metrics = [
        ("257.65", "output tokens/s", "vLLM graph at concurrency 8"),
        ("12.47x", "serving uplift", "versus serialized Transformers"),
        ("85.35x", "ASR aggregate RT", "native Qwen3-ASR batch 8"),
        ("PASS", "voice evidence", "internal deterministic gate"),
        ("7/7", "adversarial proof", "mail.send remains DENY"),
        ("68/68", "regression tests", "typecheck + production build"),
    ]
    card_w = 500
    gap = 40
    for index, (value, title, note) in enumerate(metrics):
        row = index // 3
        column = index % 3
        x = 110 + column * (card_w + gap)
        card_y = y + row * 260
        rounded_box(draw, (x, card_y, x + card_w, card_y + 225), WHITE, LINE, radius=18, width=2)
        metric_color = ACCENT_DARK if index < 3 else GREEN
        draw.text((x + 28, card_y + 25), value, font=font(51, bold=True), fill=metric_color)
        draw.text((x + 28, card_y + 94), title, font=font(25, bold=True), fill=INK)
        draw_wrapped(draw, (x + 28, card_y + 137), note, font(20), MUTED, card_w - 56, 7)

    draw.text((110, 1245), "SPEECH + DEMONSTRATION + LOCAL POLICY", font=font(25, bold=True, mono=True), fill=BLUE)
    steps = [
        ("1", "Hear hidden rules", "exceptions, conditions and prohibitions"),
        ("2", "Observe real tools", "action trace, parameters and state"),
        ("3", "Retrieve authority", "local policy evidence and boundaries"),
        ("4", "Prove + remember", "7/7 + hashed receipts + versioned memory"),
    ]
    sy = 1320
    step_w = 375
    for idx, (number, title, body) in enumerate(steps):
        x = 110 + idx * 405
        rounded_box(draw, (x, sy, x + step_w, sy + 255), WHITE, LINE, radius=18, width=2)
        draw.ellipse((x + 24, sy + 24, x + 88, sy + 88), fill=ACCENT if idx < 2 else GREEN)
        nfont = font(28, bold=True)
        bbox = draw.textbbox((0, 0), number, font=nfont)
        draw.text((x + 56 - (bbox[2] - bbox[0]) / 2, sy + 38), number, font=nfont, fill=WHITE)
        if idx < len(steps) - 1:
            arrow(draw, (x + step_w + 8, sy + 128), (x + step_w + 30, sy + 128), color=BLUE, width=4)
        draw.text((x + 24, sy + 112), title, font=font(25, bold=True), fill=INK)
        draw_wrapped(draw, (x + 24, sy + 157), body, font(20), MUTED, step_w - 48, 7)

    proof_y = 1645
    rounded_box(draw, (110, proof_y, 840, proof_y + 420), WHITE, GREEN, radius=22, width=3)
    draw.text((145, proof_y + 34), "VERIFIED SKILL PACKAGE", font=font(22, bold=True, mono=True), fill=GREEN)
    items = [
        "portable Agent Skill Markdown + policy",
        "positive and adversarial fixtures",
        "hashed receipts + artifact integrity fields",
        "source-bound Voice Evidence",
        "versioned memory + child-run lineage",
    ]
    for idx, item in enumerate(items):
        iy = proof_y + 96 + idx * 61
        draw.rounded_rectangle((146, iy, 176, iy + 30), radius=7, fill=GREEN_BG, outline=GREEN, width=2)
        draw.line((154, iy + 16, 162, iy + 23), fill=GREEN, width=4)
        draw.line((162, iy + 23, 173, iy + 7), fill=GREEN, width=4)
        draw.text((198, iy - 1), item, font=font(21, bold=idx == 4), fill=INK)

    rounded_box(draw, (880, proof_y, 1690, proof_y + 420), INK, INK, radius=22, width=2)
    draw.text((920, proof_y + 34), "LIVE PRODUCT PATH", font=font(22, bold=True, mono=True), fill="#B9E1CC")
    deployment = [
        "Cloudflare Pages module UI",
        "authenticated same-origin gateway",
        "W7900 Qwen3-ASR + Qwen3-4B",
        "deterministic safety + proof kernel",
    ]
    for idx, item in enumerate(deployment):
        draw.text((922, proof_y + 100 + idx * 58), f"0{idx + 1}", font=font(18, bold=True, mono=True), fill="#F4B6B2")
        draw.text((974, proof_y + 96 + idx * 58), item, font=font(22, bold=True), fill=WHITE)
    draw.text((922, proof_y + 352), "mail.send = DENY", font=font(30, bold=True), fill="#F4B6B2")
    draw.text((1285, proof_y + 352), "7/7 PASS", font=font(30, bold=True), fill="#B9E1CC")

    draw.rounded_rectangle((110, 2130, 1690, 2350), radius=22, fill="#E4EEF3", outline=BLUE, width=3)
    draw.text((150, 2165), "WATCH THE REAL PATH", font=font(20, bold=True, mono=True), fill=BLUE)
    draw.text((150, 2210), "radeon-voice-skill-foundry.pages.dev", font=font(34, bold=True), fill=INK)
    draw.text(
        (150, 2265),
        "Product Demo: public W7900 workflow  |  Technical evidence: GitHub Release + evidence index",
        font=font(22),
        fill=MUTED,
    )

    draw.text((110, 2405), "Track 2 | Chengyuan Ma | github.com/Chengyuann/radeon-voice-skill-foundry", font=font(24, bold=True), fill=INK)
    draw.text((110, 2450), "Not speech-to-text-to-chat: cross-modal evidence becomes a verified Agent Skill.", font=font(23), fill=MUTED)

    png = SUBMISSION / "POSTER.png"
    image.save(png, quality=95)

    pdf = SUBMISSION / "POSTER.pdf"
    canvas_doc = pdf_canvas.Canvas(str(pdf), pagesize=A4)
    canvas_doc.setTitle("Radeon Voice Skill Foundry - Poster")
    canvas_doc.setAuthor("Chengyuan Ma")
    canvas_doc.setSubject("AMD AI DevMaster Hackathon Track 2")
    canvas_doc.setCreator("Radeon Voice Skill Foundry submission asset builder")
    canvas_doc.drawImage(str(png), 0, 0, width=A4[0], height=A4[1])
    canvas_doc.showPage()
    canvas_doc.save()
    return png, pdf


def markdown_runs(text: str) -> str:
    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    escaped = re.sub(r"`([^`]+)`", r'<font name="RVSFMono">\1</font>', escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", escaped)
    return escaped


def parse_table(lines: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell or "") for cell in cells):
            continue
        rows.append(cells)
    return rows


def build_spec_pdf(architecture_path: Path, cross_modal_path: Path) -> Path:
    pdfmetrics.registerFont(TTFont("RVSF", FONT_REGULAR))
    pdfmetrics.registerFont(TTFont("RVSFBold", FONT_BOLD))
    pdfmetrics.registerFont(TTFont("RVSFItalic", FONT_ITALIC))
    pdfmetrics.registerFont(TTFont("RVSFMono", FONT_MONO))
    pdfmetrics.registerFontFamily(
        "RVSF",
        normal="RVSF",
        bold="RVSFBold",
        italic="RVSFItalic",
        boldItalic="RVSFBold",
    )

    path = SUBMISSION / "PROJECT_SPECIFICATION.pdf"
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=17 * mm,
        bottomMargin=17 * mm,
        title="Radeon Voice Skill Foundry - Project Specification",
        author="Chengyuan Ma",
        subject="AMD AI DevMaster Hackathon Track 2",
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="RVSFBold",
            fontSize=29,
            leading=33,
            textColor=colors.HexColor(INK),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSubtitle",
            fontName="RVSFBold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor(ACCENT_DARK),
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1x",
            fontName="RVSFBold",
            fontSize=17,
            leading=21,
            textColor=colors.HexColor(INK),
            spaceBefore=12,
            spaceAfter=7,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2x",
            fontName="RVSFBold",
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor(BLUE),
            spaceBefore=9,
            spaceAfter=5,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Bodyx",
            fontName="RVSF",
            fontSize=9.4,
            leading=13.2,
            textColor=colors.HexColor(INK),
            spaceAfter=5.5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Bulletx",
            fontName="RVSF",
            fontSize=9.1,
            leading=12.6,
            textColor=colors.HexColor(INK),
            leftIndent=12,
            firstLineIndent=-7,
            bulletIndent=3,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Quotex",
            fontName="RVSFItalic",
            fontSize=9.6,
            leading=13.5,
            textColor=colors.HexColor(ACCENT_DARK),
            leftIndent=12,
            rightIndent=12,
            borderColor=colors.HexColor(ACCENT),
            borderWidth=0,
            borderPadding=8,
            backColor=colors.HexColor("#FBEAE8"),
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Codex",
            fontName="RVSFMono",
            fontSize=7.9,
            leading=10.8,
            textColor=colors.HexColor(INK),
            leftIndent=8,
            rightIndent=8,
            borderPadding=7,
            backColor=colors.HexColor("#F1F3F3"),
            spaceBefore=4,
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Smallx",
            fontName="RVSF",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(MUTED),
            spaceAfter=4,
        )
    )

    story: list = []
    story.append(Spacer(1, 15 * mm))
    story.append(Paragraph("Radeon Voice Skill Foundry", styles["CoverTitle"]))
    story.append(Paragraph("Speak the SOP. Prove the Skill.", styles["CoverSubtitle"]))
    story.append(
        Paragraph(
            "AMD AI DevMaster Hackathon - Track 2<br/>"
            "Chengyuan Ma | Solo participant | GitHub: Chengyuann",
            ParagraphStyle(
                "CoverMeta",
                parent=styles["Bodyx"],
                fontSize=11,
                leading=16,
                textColor=colors.HexColor(MUTED),
                spaceAfter=12,
            ),
        )
    )
    story.append(HRFlowable(width="100%", thickness=3, color=colors.HexColor(ACCENT), spaceAfter=12))
    story.append(
        Paragraph(
            "<b>Private voice + source evidence + action trace -> governed skill + proof</b>",
            ParagraphStyle(
                "CoverClaim",
                parent=styles["Bodyx"],
                fontSize=15,
                leading=20,
                textColor=colors.HexColor(INK),
                spaceAfter=14,
            ),
        )
    )
    lead = Table(
        [
            [
                Paragraph("<b>257.65 tok/s</b><br/><font size=8>vLLM graph C8</font>", styles["Bodyx"]),
                Paragraph("<b>12.47x</b><br/><font size=8>serving uplift</font>", styles["Bodyx"]),
                Paragraph("<b>85.35x</b><br/><font size=8>ASR batch real-time</font>", styles["Bodyx"]),
                Paragraph("<b>PASS / 7 / 68</b><br/><font size=8>voice gate / proof / tests</font>", styles["Bodyx"]),
            ]
        ],
        colWidths=[41 * mm] * 4,
    )
    lead.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(WHITE)),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(LINE)),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor(LINE)),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(lead)
    story.append(Spacer(1, 14 * mm))
    story.append(
        Paragraph(
            "The result is a source-bound Agent Skill package with explicit permissions, adversarial tests, hashed receipts, and versioned memory.",
            styles["Quotex"],
        )
    )
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph("Project Specification | Submission Package", styles["Smallx"]))
    story.append(PageBreak())

    md_lines = (SUBMISSION / "PROJECT_SPECIFICATION.md").read_text().splitlines()
    index = 0
    architecture_inserted = False
    cross_modal_inserted = False
    in_code = False
    code_lines: list[str] = []
    while index < len(md_lines):
        line = md_lines[index].rstrip()
        stripped = line.strip()

        if index < 10 and (
            stripped.startswith("# ")
            or stripped.startswith("## Speak")
            or stripped.startswith("**AMD")
            or stripped.startswith("**Team")
            or stripped.startswith("**GitHub")
            or stripped.startswith("**Repository")
        ):
            index += 1
            continue

        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_lines = []
            else:
                story.append(Paragraph("<br/>".join(markdown_runs(x) for x in code_lines), styles["Codex"]))
                in_code = False
            index += 1
            continue
        if in_code:
            code_lines.append(line)
            index += 1
            continue

        if stripped.startswith("|") and index + 1 < len(md_lines) and md_lines[index + 1].strip().startswith("|"):
            table_lines = []
            while index < len(md_lines) and md_lines[index].strip().startswith("|"):
                table_lines.append(md_lines[index])
                index += 1
            rows = parse_table(table_lines)
            if rows:
                cell_style = ParagraphStyle(
                    "TableCell",
                    parent=styles["Bodyx"],
                    fontSize=7.8,
                    leading=10.2,
                    spaceAfter=0,
                )
                data = [[Paragraph(markdown_runs(cell), cell_style) for cell in row] for row in rows]
                cols = len(rows[0])
                widths = [doc.width / cols] * cols
                table = Table(data, colWidths=widths, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(INK)),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("FONTNAME", (0, 0), (-1, 0), "RVSFBold"),
                            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor(WHITE)),
                            ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor(LINE)),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 5),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                            ("TOPPADDING", (0, 0), (-1, -1), 5),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ]
                    )
                )
                story.append(Spacer(1, 3))
                story.append(table)
                story.append(Spacer(1, 7))
            continue

        if stripped.startswith("## "):
            heading = stripped[3:]
            story.append(Paragraph(markdown_runs(heading), styles["H1x"]))
            if heading.startswith("3. Why Voice Is Structurally Necessary") and not cross_modal_inserted:
                story.append(
                    KeepTogether(
                        [
                            Spacer(1, 4),
                            RLImage(str(cross_modal_path), width=doc.width, height=doc.width * 1500 / 2400),
                            Paragraph(
                                "Figure 1. Cross-modal policy induction. Speech supplies hidden rules, demonstrations supply tool/action evidence, local policy supplies authority, and conflicts fail closed through the audio-native critic.",
                                styles["Smallx"],
                            ),
                        ]
                    )
                )
                cross_modal_inserted = True
            if heading.startswith("4. Agent Architecture") and not architecture_inserted:
                story.append(
                    KeepTogether(
                        [
                            Spacer(1, 4),
                            RLImage(str(architecture_path), width=doc.width, height=doc.width * 1420 / 2400),
                            Paragraph(
                                "Figure 2. Public-to-W7900 voice-to-verified-skill architecture. Core ASR and Agent inference run on Radeon; source evidence, safety, replay, persistence, and hashing remain deterministic.",
                                styles["Smallx"],
                            ),
                        ]
                    )
                )
                architecture_inserted = True
            index += 1
            continue
        if stripped.startswith("### "):
            story.append(Paragraph(markdown_runs(stripped[4:]), styles["H2x"]))
            index += 1
            continue
        if stripped.startswith("> "):
            quote = stripped[2:]
            while index + 1 < len(md_lines) and md_lines[index + 1].strip().startswith("> "):
                index += 1
                quote += " " + md_lines[index].strip()[2:]
            story.append(Paragraph(markdown_runs(quote), styles["Quotex"]))
            index += 1
            continue
        if re.match(r"^\d+\.\s+", stripped):
            story.append(Paragraph(markdown_runs(stripped), styles["Bulletx"]))
            index += 1
            continue
        if stripped.startswith("- "):
            story.append(Paragraph("• " + markdown_runs(stripped[2:]), styles["Bulletx"]))
            index += 1
            continue
        if not stripped:
            story.append(Spacer(1, 2.5))
            index += 1
            continue

        paragraph = stripped
        while (
            index + 1 < len(md_lines)
            and md_lines[index + 1].strip()
            and not md_lines[index + 1].strip().startswith(("#", "-", ">", "|", "```"))
            and not re.match(r"^\d+\.\s+", md_lines[index + 1].strip())
        ):
            index += 1
            paragraph += " " + md_lines[index].strip()
        story.append(Paragraph(markdown_runs(paragraph), styles["Bodyx"]))
        index += 1

    def page(canvas, document) -> None:
        canvas.saveState()
        canvas.setCreator("Radeon Voice Skill Foundry submission asset builder")
        page_num = canvas.getPageNumber()
        if page_num > 1:
            canvas.setStrokeColor(colors.HexColor(LINE))
            canvas.setLineWidth(0.5)
            canvas.line(18 * mm, 12 * mm, A4[0] - 18 * mm, 12 * mm)
            canvas.setFont("RVSF", 7.5)
            canvas.setFillColor(colors.HexColor(MUTED))
            canvas.drawString(18 * mm, 8 * mm, "Radeon Voice Skill Foundry | AMD AI DevMaster Track 2")
            canvas.drawRightString(A4[0] - 18 * mm, 8 * mm, str(page_num))
        canvas.restoreState()

    doc.build(story, onFirstPage=page, onLaterPages=page)
    return path


def main() -> None:
    SUBMISSION.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    architecture = build_architecture()
    cross_modal = build_cross_modal_policy()
    judge_result_card = build_judge_result_card()
    poster_png, poster_pdf = build_poster()
    spec_pdf = build_spec_pdf(architecture, cross_modal)
    print(
        json.dumps(
            {
                "architecture": str(architecture),
                "crossModalPolicy": str(cross_modal),
                "judgeResultCard": str(judge_result_card),
                "posterPng": str(poster_png),
                "posterPdf": str(poster_pdf),
                "specPdf": str(spec_pdf),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
