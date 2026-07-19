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
        "Cloudflare product -> authenticated W7900 inference -> governed skill -> durable proof",
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
        ("LOCAL CONTEXT", "Policy / SOP RAG", "Retrieved evidence injected", BLUE_BG, BLUE),
        ("SAFETY KERNEL", "Least Privilege", "deny / review / redact / confirm", AMBER_BG, AMBER),
        ("VERIFICATION", "Adversarial Replay", "7/7 + receipts + proof hash", GREEN_BG, GREEN),
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
        "Main Demo V2 proves real W7900 inference. Continuous Demo V2 proves restart and revalidation control.",
        font=font(25, bold=True),
        fill=INK,
    )

    path = SUBMISSION / "ARCHITECTURE.png"
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
    draw.text((110, 254), "SPEAK THE SOP. PROVE THE SKILL.", font=font(25, bold=True, mono=True), fill="#D8DCDE")

    draw.text((110, 395), "A local Agent can observe clicks.", font=font(44, bold=True), fill=INK)
    draw.text((110, 455), "It cannot infer the hidden rules.", font=font(44, bold=True), fill=ACCENT_DARK)
    draw_wrapped(
        draw,
        (110, 535),
        "Voice captures exceptions and prohibited actions. The W7900 compiles those rules into a least-privilege skill, then adversarial replay proves it before promotion.",
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
        ("100/100", "voice evidence", "clean source passed v0.3"),
        ("7/7", "adversarial proof", "mail.send remains DENY"),
        ("36/36", "current tests", "typecheck + production build"),
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

    draw.text((110, 1245), "VOICE-TO-VERIFIED-SKILL", font=font(25, bold=True, mono=True), fill=BLUE)
    steps = [
        ("1", "Speak + demonstrate", "Private SOP and aligned action trace"),
        ("2", "Measure + transcribe", "Voice Evidence v0.3 + local ASR"),
        ("3", "Compile on W7900", "RAG + constraints + least privilege"),
        ("4", "Prove + remember", "7/7 + receipts + durable child proofs"),
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
    draw.text((145, proof_y + 34), "PROOF-CARRYING OUTPUT", font=font(22, bold=True, mono=True), fill=GREEN)
    items = [
        "GAIA-compatible SKILL.md + policy",
        "positive and adversarial fixtures",
        "governance receipts + artifact hashes",
        "source-bound Voice Evidence",
        "versioned memory + child-proof lineage",
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
        "Main Demo V2: real W7900 inference  |  Continuous Demo V2: restart + revalidation",
        font=font(22),
        fill=MUTED,
    )

    draw.text((110, 2405), "Track 2 | Team N/A | github.com/Chengyuann/radeon-voice-skill-foundry", font=font(24, bold=True), fill=INK)
    draw.text((110, 2450), "Actions capture what happened. Voice captures why, when, and what must never happen.", font=font(23), fill=MUTED)

    png = SUBMISSION / "POSTER.png"
    image.save(png, quality=95)

    pdf = SUBMISSION / "POSTER.pdf"
    canvas_doc = pdf_canvas.Canvas(str(pdf), pagesize=A4)
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


def build_spec_pdf(architecture_path: Path) -> Path:
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
        author="Chengyuann",
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
            "Team N/A (solo) | GitHub: Chengyuann",
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
                Paragraph("<b>100 / 7 / 36</b><br/><font size=8>voice / proof / tests</font>", styles["Bodyx"]),
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
            "The result is not a transcript. It is a source-bound, proof-carrying local Agent Skill with permissions, adversarial tests, receipts, and versioned memory.",
            styles["Quotex"],
        )
    )
    story.append(Spacer(1, 30 * mm))
    story.append(Paragraph("Project Specification | 2026-07-19", styles["Smallx"]))
    story.append(PageBreak())

    md_lines = (SUBMISSION / "PROJECT_SPECIFICATION.md").read_text().splitlines()
    index = 0
    architecture_inserted = False
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
            if heading.startswith("4. Agent Architecture") and not architecture_inserted:
                story.append(
                    KeepTogether(
                        [
                            Spacer(1, 4),
                            RLImage(str(architecture_path), width=doc.width, height=doc.width * 1420 / 2400),
                            Paragraph(
                                "Figure 1. Public-to-W7900 voice-to-verified-skill architecture. Core ASR and Agent inference run on Radeon; source evidence, safety, replay, persistence, and hashing remain deterministic.",
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
    poster_png, poster_pdf = build_poster()
    spec_pdf = build_spec_pdf(architecture)
    print(
        json.dumps(
            {
                "architecture": str(architecture),
                "posterPng": str(poster_png),
                "posterPdf": str(poster_pdf),
                "specPdf": str(spec_pdf),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
