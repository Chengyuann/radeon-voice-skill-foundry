#!/usr/bin/env python3
"""Build a compact lineage diagram from the submitted parent and child proofs."""

from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "submission"
OUTPUT = SUBMISSION / "MULTI_TURN_LINEAGE.png"
PARENT_PROOF = SUBMISSION / "VERIFIED_WORKFLOW_PROOF.zip"
CHILD_PROOF = SUBMISSION / "MULTI_TURN_REFINEMENT_PROOF.zip"
EVIDENCE = SUBMISSION / "MULTI_TURN_REFINEMENT.json"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"

INK = "#202224"
MUTED = "#6E7377"
LINE = "#D9DDDF"
SURFACE = "#F8F9F9"
WHITE = "#FFFFFF"
ACCENT = "#C23A35"
BLUE = "#345F78"
BLUE_BG = "#E4EEF3"
GREEN = "#2F6A4F"
GREEN_BG = "#E6F1EB"
AMBER = "#7F5A23"
AMBER_BG = "#F4ECDA"
BG = "#EEF0F1"


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_MONO if mono else FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(path, size=size)


def proof(path: Path) -> dict:
    with ZipFile(path) as archive:
        member = next(name for name in archive.namelist() if name.endswith("proof_bundle.json"))
        return json.loads(archive.read(member))


def box(
    draw: ImageDraw.ImageDraw,
    coords: tuple[int, int, int, int],
    fill: str = WHITE,
    outline: str = LINE,
    width: int = 2,
) -> None:
    draw.rounded_rectangle(coords, radius=8, fill=fill, outline=outline, width=width)


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int, color: str = INK, bold: bool = False, mono: bool = False) -> None:
    draw.text(xy, value, font=font(size, bold=bold, mono=mono), fill=color)


def metric(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, value: str, color: str = INK) -> None:
    text(draw, (x, y), label.upper(), 17, MUTED, bold=True)
    text(draw, (x, y + 30), value, 28, color, bold=True, mono=True)


def run_panel(draw: ImageDraw.ImageDraw, x: int, title: str, data: dict, current: bool) -> None:
    y = 230
    panel_width = 500
    box(
        draw,
        (x, y, x + panel_width, 660),
        fill=BLUE_BG if current else WHITE,
        outline=BLUE if current else LINE,
        width=3 if current else 2,
    )
    text(draw, (x + 32, y + 28), title.upper(), 18, BLUE if current else MUTED, bold=True)
    text(draw, (x + 32, y + 64), f"Revision {data['revision']}", 40, INK, bold=True)
    text(draw, (x + 32, y + 120), data["runId"], 21, INK, mono=True)

    metric(draw, x + 32, y + 180, "Constraints", str(len(data["constraints"])), BLUE if current else INK)
    metric(draw, x + 248, y + 180, "Fixtures", str(len(data["fixtures"])), BLUE if current else INK)

    text(draw, (x + 32, y + 282), "PROOF STATUS", 17, MUTED, bold=True)
    status_fill = GREEN_BG if data["status"] == "verified" else AMBER_BG
    status_color = GREEN if data["status"] == "verified" else AMBER
    draw.rounded_rectangle((x + 32, y + 315, x + 180, y + 361), radius=6, fill=status_fill)
    text(draw, (x + 54, y + 326), data["status"].upper(), 18, status_color, bold=True)
    text(draw, (x + 32, y + 382), data["proofHash"][:16] + "...", 18, MUTED, mono=True)


def main() -> None:
    parent = proof(PARENT_PROOF)
    child = proof(CHILD_PROOF)
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))

    if child.get("parentRunId") != parent.get("runId"):
        raise RuntimeError("Child proof does not reference the submitted parent proof")
    if child.get("proofHash") != evidence.get("proofHash"):
        raise RuntimeError("Child proof hash does not match the submitted lineage metadata")

    image = Image.new("RGB", (1600, 900), BG)
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 18, 900), fill=ACCENT)
    text(draw, (82, 62), "MULTI-TURN POLICY REFINEMENT", 20, ACCENT, bold=True)
    text(draw, (82, 102), "A correction creates a verified child run", 48, INK, bold=True)
    text(
        draw,
        (82, 166),
        "The parent remains immutable; constraints, permissions, fixtures, and proof are regenerated.",
        24,
        MUTED,
    )

    run_panel(draw, 82, "Parent compile", parent, current=False)
    run_panel(draw, 1018, "Child compile", child, current=True)

    box(draw, (624, 278, 976, 604), fill=WHITE, outline="#C8CCCE")
    text(draw, (660, 310), "USER CORRECTION", 17, ACCENT, bold=True)
    correction_lines = [
        "Always require confirmation",
        "before creating",
        "calendar holds.",
    ]
    for index, line in enumerate(correction_lines):
        text(draw, (660, 354 + index * 38), line, 25, INK, bold=index == 0)
    text(draw, (660, 492), "RECOMPILE ON RADEON", 17, BLUE, bold=True)
    text(draw, (660, 526), "3 RAG matches", 19, MUTED, mono=True)
    text(draw, (660, 556), "parentRunId preserved", 19, MUTED, mono=True)

    draw.line((582, 442, 624, 442), fill=BLUE, width=4)
    draw.polygon([(624, 442), (606, 432), (606, 452)], fill=BLUE)
    draw.line((976, 442, 1018, 442), fill=BLUE, width=4)
    draw.polygon([(1018, 442), (1000, 432), (1000, 452)], fill=BLUE)

    box(draw, (82, 710, 1518, 834), fill=INK, outline=INK)
    text(draw, (112, 738), "NEW ENFORCEABLE RULE", 17, "#F4B6B2", bold=True)
    text(
        draw,
        (112, 774),
        "Require human confirmation before creating calendar holds",
        29,
        WHITE,
        bold=True,
    )
    text(draw, (1120, 738), "RUNTIME", 17, "#9DC3D5", bold=True)
    text(draw, (1120, 774), "W7900 · ROCm 7.2.1", 22, WHITE, bold=True, mono=True)

    image.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()
