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
        "Private voice + source evidence + action trace -> governed skill + proof",
        font=font(30),
        fill=MUTED,
    )

    gpu_box = (530, 278, 1870, 750)
    rounded_box(draw, gpu_box, WHITE, ACCENT, radius=26, width=4)
    draw.text((580, 306), "AMD RADEON GPU + ROCm 7.2.1", font=font(27, bold=True), fill=ACCENT_DARK)
    draw.text((580, 346), "W7900-class | gfx1100 | local FP16 inference", font=font(22), fill=MUTED)

    boxes = [
        ((100, 390, 430, 625), "1  CAPTURE", "Voice SOP", "16 kHz mono WAV\n+ action events", BLUE_BG, BLUE),
        ((610, 420, 1010, 650), "2  LOCAL ASR", "Qwen3-ASR-0.6B", "Transcript + timing\n17.98x real-time", "#FBEAE8", ACCENT_DARK),
        ((1130, 420, 1530, 650), "3  AGENT COMPILER", "Qwen3-4B-Instruct", "Typed constraints\n+ multi-step skill", "#FBEAE8", ACCENT_DARK),
        ((1970, 390, 2300, 625), "4  OUTPUT", "Proof-carrying Skill", "SKILL.md + policy\n+ tests + receipts", GREEN_BG, GREEN),
    ]

    for rect, eyebrow, title, body, fill, accent in boxes:
        rounded_box(draw, rect, fill, outline=accent, radius=22, width=3)
        x1, y1, x2, _ = rect
        draw.text((x1 + 28, y1 + 28), eyebrow, font=font(20, bold=True, mono=True), fill=accent)
        draw.text((x1 + 28, y1 + 78), title, font=font(30, bold=True), fill=INK)
        for idx, line in enumerate(body.splitlines()):
            draw.text((x1 + 28, y1 + 132 + idx * 38), line, font=font(22), fill=MUTED)

    arrow(draw, (430, 507), (610, 507), color=ACCENT)
    arrow(draw, (1010, 535), (1130, 535), color=ACCENT)
    arrow(draw, (1530, 535), (1970, 507), color=ACCENT)

    rag = (930, 805, 1450, 1015)
    guard = (300, 805, 820, 1015)
    verify = (1580, 805, 2100, 1015)
    memory = (790, 1110, 1610, 1322)
    evidence = (100, 260, 430, 370)

    for rect, eyebrow, title, body, fill, accent in [
        (rag, "LOCAL CONTEXT", "Policy / SOP RAG", "Evidence injected into compilation", BLUE_BG, BLUE),
        (guard, "DETERMINISTIC CPU", "Safety Kernel", "deny / review / redact / confirm", AMBER_BG, AMBER),
        (verify, "DETERMINISTIC CPU", "Verification", "adversarial replay + hashes", GREEN_BG, GREEN),
        (memory, "PROCEDURAL MEMORY", "Versioned Verified Skill Registry", "Exact reuse: 2.18 ms median HTTP", WHITE, GREEN),
    ]:
        rounded_box(draw, rect, fill, outline=accent, radius=22, width=3)
        x1, y1, x2, _ = rect
        draw.text((x1 + 28, y1 + 26), eyebrow, font=font(19, bold=True, mono=True), fill=accent)
        draw.text((x1 + 28, y1 + 70), title, font=font(29, bold=True), fill=INK)
        draw_wrapped(draw, (x1 + 28, y1 + 120), body, font(21), MUTED, x2 - x1 - 56, 7)

    rounded_box(draw, evidence, AMBER_BG, outline=AMBER, radius=18, width=3)
    draw.text((124, 280), "VOICE EVIDENCE GATE", font=font(16, bold=True, mono=True), fill=AMBER)
    draw.text((124, 316), "level | clipping | silence | hashes", font=font(18, bold=True), fill=INK)
    draw.text((124, 345), "PASS / REVIEW / QUARANTINE", font=font(14), fill=MUTED)
    arrow(draw, (265, 370), (265, 390), color=AMBER)

    arrow(draw, (1190, 805), (1290, 650), color=BLUE)
    arrow(draw, (1250, 650), (560, 805), color=AMBER)
    arrow(draw, (1410, 650), (1840, 805), color=GREEN)
    arrow(draw, (1840, 1015), (1450, 1110), color=GREEN)
    arrow(draw, (1040, 1110), (560, 1015), color=GREEN)

    draw.text((120, 1356), "Actions capture what happened. Voice captures why, when, and what must never happen.", font=font(27, bold=True), fill=INK)

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

    draw.text((110, 410), "A local Agent can observe clicks.", font=font(44, bold=True), fill=INK)
    draw.text((110, 470), "It cannot infer the hidden rules.", font=font(44, bold=True), fill=ACCENT_DARK)
    draw_wrapped(
        draw,
        (110, 550),
        "Voice captures exceptions and prohibited actions. Server-held evidence checks level, clipping, silence, source integrity, and the original ASR transcript before promotion.",
        font(29),
        MUTED,
        1580,
        12,
    )

    y = 735
    metrics = [
        ("29.42%", "fewer output tokens", "compact structured output"),
        ("30.03%", "lower generation latency", "same W7900 + same model"),
        ("100/100", "voice evidence gate", "20.39 s SOP WAV passed"),
    ]
    card_w = 500
    gap = 40
    for index, (value, title, note) in enumerate(metrics):
        x = 110 + index * (card_w + gap)
        rounded_box(draw, (x, y, x + card_w, y + 325), WHITE, LINE, radius=18, width=2)
        draw.text((x + 30, y + 38), value, font=font(57, bold=True), fill=ACCENT_DARK if index < 2 else GREEN)
        draw.text((x + 30, y + 120), title, font=font(27, bold=True), fill=INK)
        draw_wrapped(draw, (x + 30, y + 170), note, font(22), MUTED, card_w - 60, 9)

    draw.text((110, 1160), "VOICE-TO-VERIFIED-SKILL", font=font(25, bold=True, mono=True), fill=BLUE)
    steps = [
        ("1", "Speak + demonstrate", "Private SOP and aligned action trace"),
        ("2", "Measure the source", "Level, clipping, silence, audio hash"),
        ("3", "Compile locally", "Qwen3-ASR + Qwen3-4B on Radeon"),
        ("4", "Prove + reuse", "Policy, tests, receipts, skill memory"),
    ]
    sy = 1230
    for idx, (number, title, body) in enumerate(steps):
        box_y = sy + idx * 180
        draw.ellipse((110, box_y, 180, box_y + 70), fill=ACCENT if idx < 2 else GREEN)
        nfont = font(28, bold=True)
        bbox = draw.textbbox((0, 0), number, font=nfont)
        draw.text((145 - (bbox[2] - bbox[0]) / 2, box_y + 17), number, font=nfont, fill=WHITE)
        if idx < len(steps) - 1:
            draw.line((145, box_y + 72, 145, box_y + 175), fill="#B9BEC1", width=5)
        draw.text((220, box_y + 2), title, font=font(31, bold=True), fill=INK)
        draw.text((220, box_y + 52), body, font=font(24), fill=MUTED)

    proof_x, proof_y = 980, 1208
    rounded_box(draw, (proof_x, proof_y, 1690, 1925), WHITE, GREEN, radius=22, width=3)
    draw.text((proof_x + 38, proof_y + 35), "PROOF-CARRYING OUTPUT", font=font(23, bold=True, mono=True), fill=GREEN)
    items = [
        "GAIA-compatible SKILL.md",
        "least-privilege policy.yaml",
        "positive + adversarial fixtures",
        "governance receipts",
        "hash-bound proof_bundle.json",
        "source-bound voice_evidence.json",
        "versioned procedural memory",
    ]
    for idx, item in enumerate(items):
        iy = proof_y + 102 + idx * 72
        draw.rounded_rectangle((proof_x + 40, iy, proof_x + 72, iy + 32), radius=7, fill=GREEN_BG, outline=GREEN, width=2)
        draw.line((proof_x + 49, iy + 17, proof_x + 57, iy + 25), fill=GREEN, width=4)
        draw.line((proof_x + 57, iy + 25, proof_x + 68, iy + 8), fill=GREEN, width=4)
        draw.text((proof_x + 95, iy - 2), item, font=font(25, bold=idx == 3), fill=INK)

    draw.rounded_rectangle((110, 2045, 1690, 2335), radius=22, fill=INK)
    draw.text((155, 2092), "Radeon Pro W7900-class | gfx1100 | ROCm 7.2.1", font=font(29, bold=True), fill=WHITE)
    draw.text((155, 2152), "Qwen3-ASR-0.6B  ->  Qwen3-4B-Instruct  ->  deterministic verifier", font=font(24, mono=True), fill="#D8DCDE")
    draw.text((155, 2220), "mail.send = DENY", font=font(39, bold=True), fill="#F4B6B2")
    draw.text((620, 2220), "Local audio proof: 7/7", font=font(39, bold=True), fill="#B9E1CC")

    draw.text((110, 2395), "Track 2 | Team N/A | github.com/Chengyuann/radeon-voice-skill-foundry", font=font(24, bold=True), fill=INK)
    draw.text((110, 2440), "Actions capture what happened. Voice captures why, when, and what must never happen.", font=font(23), fill=MUTED)

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
                Paragraph("<b>W7900-class</b><br/><font size=8>gfx1100, 47.98 GiB</font>", styles["Bodyx"]),
                Paragraph("<b>17.98x</b><br/><font size=8>ASR real-time</font>", styles["Bodyx"]),
                Paragraph("<b>-30.03%</b><br/><font size=8>generation latency</font>", styles["Bodyx"]),
                Paragraph("<b>100/100</b><br/><font size=8>voice evidence gate</font>", styles["Bodyx"]),
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
    story.append(Paragraph("Project Specification | 2026-07-18", styles["Smallx"]))
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
                                "Figure 1. Local voice-to-verified-skill architecture. Red paths run on Radeon GPU; source evidence, safety, replay, and hashing remain deterministic.",
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
