#!/usr/bin/env python3
"""Build the narrated AMD submission demo from validated screenshots."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "tmp" / "video" / "assets"
WORK = ROOT / "tmp" / "video" / "build"
OUTPUT = ROOT / "submission" / "RADEON_VOICE_SKILL_FOUNDRY_DEMO.mp4"
NARRATION = ROOT / "submission" / "DEMO_NARRATION.md"

WIDTH = 1920
HEIGHT = 1080
FPS = 30
BG = "#202224"
SURFACE = "#F8F9F9"
WHITE = "#FFFFFF"
INK = "#202224"
MUTED = "#AEB4B8"
LINE = "#D9DDDF"
ACCENT = "#C23A35"
GREEN = "#2F6A4F"
BLUE = "#345F78"
AMBER = "#A06B20"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_MONO = "/System/Library/Fonts/SFNSMono.ttf"

SCENES = [
    {
        "heading": "Speak the SOP. Prove the Skill.",
        "kind": "title",
        "kicker": "AMD AI DEVMASTER | TRACK 2",
    },
    {
        "heading": "Real Radeon Runtime",
        "kind": "runtime",
        "kicker": "ACTUAL RADEON CLOUD EVIDENCE",
    },
    {
        "heading": "Source-Bound Voice Evidence",
        "kind": "ui",
        "asset": "ui-evidence.png",
        "kicker": "PRODUCT UI REPLAY | SAME SOURCE WAV",
        "stats": [
            ("100/100", "VOICE EVIDENCE"),
            ("20.39 s", "SOURCE AUDIO"),
            ("0 clips", "CLIPPING"),
        ],
    },
    {
        "heading": "Local RAG and Skill Compilation",
        "kind": "ui",
        "asset": "ui-compile.png",
        "kicker": "PRODUCT UI REPLAY | RADEON V8 METRICS",
        "stats": [
            ("13", "CONSTRAINTS"),
            ("368 ms", "TTFT"),
            ("20.07", "TOKENS / S"),
        ],
    },
    {
        "heading": "Adversarial Verification",
        "kind": "ui",
        "asset": "ui-verify.png",
        "kicker": "PRODUCT UI REPLAY | SERVER-AUTHORITATIVE RUN",
        "stats": [
            ("7/7", "FIXTURES"),
            ("DENY", "MAIL.SEND"),
            ("3", "BLOCK RECEIPTS"),
        ],
    },
    {
        "heading": "Proof and Procedural Memory",
        "kind": "ui",
        "asset": "ui-proof.png",
        "kicker": "PRODUCT UI REPLAY | VERIFIED SKILL MEMORY",
        "stats": [
            ("29.42%", "FEWER TOKENS"),
            ("30.03%", "LOWER LATENCY"),
            ("2.18 ms", "EXACT REUSE"),
        ],
    },
    {
        "heading": "Final Artifact",
        "kind": "final",
        "kicker": "PROOF, NOT JUST A WORKFLOW",
    },
]


def font(size: int, *, bold: bool = False, mono: bool = False):
    path = FONT_MONO if mono else FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(path, size)


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def fit_image(image: Image.Image, box: tuple[int, int]) -> Image.Image:
    result = image.copy().convert("RGB")
    result.thumbnail(box, Image.Resampling.LANCZOS)
    return result


def redact_profile(image: Image.Image) -> Image.Image:
    result = image.copy().convert("RGB")
    draw = ImageDraw.Draw(result)
    width, height = result.size
    regions = [
        (0.83, 0.00, 1.00, 0.10),
        (0.21, 0.12, 0.53, 0.24),
        (0.21, 0.23, 0.54, 0.31),
    ]
    for left, top, right, bottom in regions:
        draw.rounded_rectangle(
            (
                round(width * left),
                round(height * top),
                round(width * right),
                round(height * bottom),
            ),
            radius=max(8, round(height * 0.012)),
            fill="#202224",
        )
    draw.text(
        (round(width * 0.23), round(height * 0.155)),
        "REDACTED ACCOUNT",
        font=font(max(14, round(height * 0.024)), bold=True, mono=True),
        fill=WHITE,
    )
    return result


def paste_center(
    canvas: Image.Image,
    image: Image.Image,
    box: tuple[int, int, int, int],
    *,
    fill: str = WHITE,
) -> None:
    x1, y1, x2, y2 = box
    panel = Image.new("RGB", (x2 - x1, y2 - y1), fill)
    fitted = fit_image(image, panel.size)
    panel.paste(
        fitted,
        ((panel.width - fitted.width) // 2, (panel.height - fitted.height) // 2),
    )
    canvas.paste(panel, (x1, y1))


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


def draw_text_block(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    typeface,
    color: str,
    width: int,
    gap: int = 8,
) -> int:
    x, y = xy
    for line in wrap(draw, text, typeface, width):
        draw.text((x, y), line, font=typeface, fill=color)
        y += typeface.size + gap
    return y


def header(draw: ImageDraw.ImageDraw, scene: dict) -> None:
    draw.text((56, 42), scene["kicker"], font=font(22, bold=True, mono=True), fill=ACCENT)
    draw.text((56, 78), scene["heading"], font=font(46, bold=True), fill=WHITE)


def stat_panel(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    stats: list[tuple[str, str]],
) -> None:
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, radius=18, fill="#2A2D2F", outline="#4A4F52", width=2)
    row_height = (y2 - y1 - 36) // len(stats)
    for index, (value, label) in enumerate(stats):
        y = y1 + 18 + index * row_height
        draw.text((x1 + 24, y), value, font=font(38, bold=True), fill=WHITE)
        draw.text((x1 + 24, y + 48), label, font=font(16, bold=True, mono=True), fill=MUTED)
        if index < len(stats) - 1:
            draw.line((x1 + 24, y + row_height - 10, x2 - 24, y + row_height - 10), fill="#44494C", width=2)


def build_board(scene: dict, index: int) -> Path:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(canvas)
    header(draw, scene)

    if scene["kind"] == "title":
        poster = Image.open(ROOT / "submission" / "POSTER.png")
        paste_center(canvas, poster, (1140, 74, 1780, 1002), fill="#ECEFF0")
        draw_text_block(
            draw,
            "Private voice + action trace becomes a governed, testable Agent Skill before the first risky run.",
            (80, 300),
            font(48, bold=True),
            WHITE,
            900,
            14,
        )
        bullets = [
            "Qwen3-ASR + Qwen3-4B on Radeon",
            "Voice Evidence Gate",
            "Least-privilege policy and adversarial fixtures",
            "Hash-bound proof and procedural memory",
        ]
        y = 600
        for bullet in bullets:
            draw.ellipse((82, y + 10, 96, y + 24), fill=GREEN)
            draw.text((118, y), bullet, font=font(28), fill="#DCE1E3")
            y += 62
    elif scene["kind"] == "runtime":
        profile = redact_profile(Image.open(ASSETS / "radeon-profile.png"))
        terminal = Image.open(ASSETS / "radeon-terminal.png")
        draw.rounded_rectangle((48, 164, 936, 1008), radius=18, fill=WHITE)
        draw.rounded_rectangle((964, 164, 1872, 1008), radius=18, fill=WHITE)
        paste_center(canvas, profile, (66, 182, 918, 990), fill=WHITE)
        paste_center(canvas, terminal, (982, 182, 1854, 990), fill="#111315")
        draw.rounded_rectangle((84, 188, 330, 228), radius=12, fill=BLUE)
        draw.text((103, 196), "CLOUD ALLOCATION", font=font(17, bold=True, mono=True), fill=WHITE)
        draw.rounded_rectangle((1000, 188, 1280, 228), radius=12, fill=GREEN)
        draw.text((1019, 196), "FINAL V8 VALIDATION", font=font(17, bold=True, mono=True), fill=WHITE)
    elif scene["kind"] == "ui":
        screenshot = Image.open(ASSETS / scene["asset"])
        draw.rounded_rectangle((40, 154, 1500, 1030), radius=18, fill="#EEF0F1")
        paste_center(canvas, screenshot, (52, 166, 1488, 1018), fill="#EEF0F1")
        stat_panel(draw, (1532, 202, 1878, 840), scene["stats"])
        draw.rounded_rectangle((1532, 870, 1878, 1018), radius=18, fill="#F6EAE9", outline="#8E302B", width=2)
        draw.text((1556, 894), "REPLAY FOOTAGE", font=font(18, bold=True, mono=True), fill="#8E302B")
        draw_text_block(
            draw,
            "The hardware numbers and proof hashes shown in this video come from the actual Radeon v8 run.",
            (1556, 930),
            font(18),
            INK,
            292,
            6,
        )
    else:
        architecture = Image.open(ROOT / "submission" / "ARCHITECTURE.png")
        draw.rounded_rectangle((48, 166, 1440, 996), radius=18, fill=SURFACE)
        paste_center(canvas, architecture, (66, 184, 1422, 978), fill=SURFACE)
        stat_panel(
            draw,
            (1480, 190, 1878, 780),
            [("100/100", "VOICE EVIDENCE"), ("7/7", "RADEON FIXTURES"), ("DENY", "MAIL.SEND")],
        )
        draw.rounded_rectangle((1480, 812, 1878, 996), radius=18, fill="#E6F1EB", outline=GREEN, width=2)
        draw.text((1506, 836), "PUBLIC ARTIFACTS", font=font(18, bold=True, mono=True), fill=GREEN)
        draw_text_block(
            draw,
            "Source code\nSpecification\nArchitecture\nPoster\nRaw benchmark JSON\nProof hashes\nDemo video",
            (1506, 876),
            font(20, bold=True),
            INK,
            330,
            7,
        )
        draw.text((1510, 1024), "AI-generated narration", font=font(15, mono=True), fill=MUTED)

    path = WORK / "boards" / f"scene-{index + 1:02d}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)
    return path


def parse_narration() -> dict[str, str]:
    text = NARRATION.read_text(encoding="utf-8")
    sections: dict[str, str] = {}
    matches = list(re.finditer(r"^## (.+)$", text, flags=re.MULTILINE))
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = re.sub(r"\s+", " ", text[start:end]).strip()
        sections[match.group(1).strip()] = body
    return sections


def probe_duration(path: Path) -> float:
    output = subprocess.check_output(
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
    )
    return float(output.strip())


def srt_time(value: float) -> str:
    millis = max(0, round(value * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    seconds, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def build_caption_card(text: str, index: int) -> Path:
    width, height = 1640, 128
    card = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(
        (0, 0, width - 1, height - 1),
        radius=18,
        fill=(18, 20, 22, 218),
        outline=(255, 255, 255, 46),
        width=2,
    )
    typeface = font(30, bold=True)
    lines = wrap(draw, text, typeface, width - 100)
    if len(lines) > 2:
        typeface = font(25, bold=True)
        lines = wrap(draw, text, typeface, width - 100)
    line_height = typeface.size + 8
    y = (height - line_height * len(lines)) // 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=typeface)
        x = (width - (bbox[2] - bbox[0])) // 2
        draw.text((x, y), line, font=typeface, fill=WHITE)
        y += line_height
    path = WORK / "captions" / f"caption-{index:03d}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    card.save(path, optimize=True)
    return path


def build() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    sections = parse_narration()
    scene_videos: list[Path] = []
    subtitle_rows: list[str] = []
    caption_entries: list[tuple[float, float, str]] = []
    timeline = 0.0

    for index, scene in enumerate(SCENES):
        text = sections[scene["heading"]]
        board = build_board(scene, index)
        audio = WORK / f"scene-{index + 1:02d}.aiff"
        run(["say", "-v", "Samantha", "-r", "165", "-o", str(audio), text])
        duration = probe_duration(audio)
        video = WORK / f"scene-{index + 1:02d}.mp4"
        frames = max(1, round(duration * FPS))
        fade_out = max(0, duration - 0.45)
        run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-loop",
                "1",
                "-i",
                str(board),
                "-i",
                str(audio),
                "-filter_complex",
                (
                    f"[0:v]zoompan=z='min(zoom+0.00012,1.018)':"
                    f"d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
                    f"fade=t=in:st=0:d=0.45,fade=t=out:st={fade_out:.3f}:d=0.45[v]"
                ),
                "-map",
                "[v]",
                "-map",
                "1:a",
                "-t",
                f"{duration:.3f}",
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
                str(video),
            ]
        )
        scene_videos.append(video)

        parts = sentences(text)
        weights = [max(1, len(part.split())) for part in parts]
        total_weight = sum(weights)
        cursor = timeline + 0.1
        usable = max(0.5, duration - 0.2)
        for part, weight in zip(parts, weights):
            part_duration = usable * weight / total_weight
            start = cursor
            end = min(timeline + duration - 0.05, cursor + part_duration)
            subtitle_rows.extend(
                [
                    str(len(subtitle_rows) // 4 + 1),
                    f"{srt_time(start)} --> {srt_time(end)}",
                    part,
                    "",
                ]
            )
            caption_entries.append((start, end, part))
            cursor = end
        timeline += duration

    concat = WORK / "concat.txt"
    concat.write_text(
        "".join(f"file '{path.as_posix()}'\n" for path in scene_videos),
        encoding="utf-8",
    )
    merged = WORK / "merged.mp4"
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
            str(concat),
            "-c",
            "copy",
            str(merged),
        ]
    )
    subtitles = WORK / "captions.srt"
    subtitles.write_text("\n".join(subtitle_rows), encoding="utf-8")

    caption_cards = [
        build_caption_card(text, index)
        for index, (_start, _end, text) in enumerate(caption_entries, start=1)
    ]
    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(merged)]
    for card in caption_cards:
        command.extend(["-loop", "1", "-i", str(card)])
    filters: list[str] = []
    previous = "0:v"
    for index, ((start, end, _text), _card) in enumerate(
        zip(caption_entries, caption_cards), start=1
    ):
        output_label = f"captioned{index}"
        filters.append(
            f"[{previous}][{index}:v]overlay="
            f"x=(W-w)/2:y=H-h-24:"
            f"enable='between(t,{start:.3f},{end:.3f})'[{output_label}]"
        )
        previous = output_label
    command.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            f"[{previous}]",
            "-map",
            "0:a",
            "-t",
            f"{timeline:.3f}",
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
    run(command)
    (ROOT / "submission" / "RADEON_VOICE_SKILL_FOUNDRY_DEMO.srt").write_text(
        subtitles.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    print(OUTPUT)
    print(f"duration={probe_duration(OUTPUT):.3f}s")


if __name__ == "__main__":
    build()
