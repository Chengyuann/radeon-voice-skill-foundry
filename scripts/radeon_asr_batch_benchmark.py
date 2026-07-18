#!/usr/bin/env python3
"""Benchmark native Qwen3-ASR batching against sequential inference on Radeon."""

from __future__ import annotations

import argparse
import difflib
import json
import time
from pathlib import Path
from statistics import median

import numpy as np
import soundfile as sf
import torch
from qwen_asr import Qwen3ASRModel


MODEL_ID = "Qwen/Qwen3-ASR-0.6B"


def normalize_text(text: str) -> str:
    return "".join(character.lower() for character in text if character.isalnum())


def relative_drift(reference: str, hypothesis: str) -> float:
    ref = normalize_text(reference)
    hyp = normalize_text(hypothesis)
    matcher = difflib.SequenceMatcher(None, ref, hyp, autojunk=False)
    matches = sum(block.size for block in matcher.get_matching_blocks())
    return round((max(len(ref), len(hyp)) - matches) / max(len(ref), 1), 4)


def load_audio(path: Path) -> tuple[np.ndarray, int]:
    audio, sample_rate = sf.read(path, dtype="float32", always_2d=False)
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    return audio, int(sample_rate)


def timed_batch(
    model: Qwen3ASRModel,
    audios: list[tuple[np.ndarray, int]],
) -> dict:
    torch.cuda.reset_peak_memory_stats()
    torch.cuda.synchronize()
    started = time.perf_counter()
    results = model.transcribe(
        audio=audios,
        language=["Chinese"] * len(audios),
        return_time_stamps=False,
    )
    torch.cuda.synchronize()
    elapsed = time.perf_counter() - started
    total_audio_seconds = sum(len(audio) / sample_rate for audio, sample_rate in audios)
    return {
        "wallMs": round(elapsed * 1000, 2),
        "aggregateAudioXRealtime": round(total_audio_seconds / max(elapsed, 1e-9), 2),
        "peakVramGiB": round(torch.cuda.max_memory_allocated() / 1024**3, 3),
        "transcripts": [result.text for result in results],
    }


def timed_sequential(
    model: Qwen3ASRModel,
    audios: list[tuple[np.ndarray, int]],
) -> dict:
    torch.cuda.reset_peak_memory_stats()
    torch.cuda.synchronize()
    started = time.perf_counter()
    transcripts = []
    for audio in audios:
        result = model.transcribe(
            audio=audio,
            language="Chinese",
            return_time_stamps=False,
        )[0]
        transcripts.append(result.text)
    torch.cuda.synchronize()
    elapsed = time.perf_counter() - started
    total_audio_seconds = sum(len(audio) / sample_rate for audio, sample_rate in audios)
    return {
        "wallMs": round(elapsed * 1000, 2),
        "aggregateAudioXRealtime": round(total_audio_seconds / max(elapsed, 1e-9), 2),
        "peakVramGiB": round(torch.cuda.max_memory_allocated() / 1024**3, 3),
        "transcripts": transcripts,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()

    paths = sorted(args.audio_dir.glob("*.wav"))
    if len(paths) < 8:
        raise RuntimeError(f"Need at least 8 WAV files under {args.audio_dir}")
    clean_path = args.audio_dir / "clean.wav"
    reference_path = clean_path if clean_path.exists() else paths[0]
    reference_audio = load_audio(reference_path)

    load_started = time.perf_counter()
    model = Qwen3ASRModel.from_pretrained(
        MODEL_ID,
        dtype=torch.float16,
        device_map="cuda:0",
        max_inference_batch_size=8,
        max_new_tokens=256,
    )
    model_load_seconds = time.perf_counter() - load_started
    reference = model.transcribe(
        audio=reference_audio,
        language="Chinese",
        return_time_stamps=False,
    )[0].text

    preferred = [
        "clean.wav",
        "noise_20.wav",
        "noise_10.wav",
        "noise_5.wav",
        "reverb_0.25.wav",
        "reverb_0.55.wav",
        "far_field.wav",
        "clipped.wav",
    ]
    selected_paths = [
        args.audio_dir / name
        for name in preferred
        if (args.audio_dir / name).exists()
    ]
    audios = [load_audio(path) for path in selected_paths]

    matrix = []
    for batch_size in [1, 2, 4, 8]:
        subset = audios[:batch_size]
        batch_runs = [timed_batch(model, subset) for _ in range(args.runs)]
        sequential_runs = [
            timed_sequential(model, subset) for _ in range(args.runs)
        ]
        batch_wall = median(run["wallMs"] for run in batch_runs)
        sequential_wall = median(run["wallMs"] for run in sequential_runs)
        matrix.append(
            {
                "batchSize": batch_size,
                "inputs": [path.name for path in selected_paths[:batch_size]],
                "batch": {
                    "medianWallMs": batch_wall,
                    "medianAggregateAudioXRealtime": median(
                        run["aggregateAudioXRealtime"] for run in batch_runs
                    ),
                    "medianPeakVramGiB": median(
                        run["peakVramGiB"] for run in batch_runs
                    ),
                    "runs": batch_runs,
                },
                "sequential": {
                    "medianWallMs": sequential_wall,
                    "medianAggregateAudioXRealtime": median(
                        run["aggregateAudioXRealtime"] for run in sequential_runs
                    ),
                    "medianPeakVramGiB": median(
                        run["peakVramGiB"] for run in sequential_runs
                    ),
                    "runs": sequential_runs,
                },
                "batchSpeedup": round(
                    sequential_wall / max(batch_wall, 1e-9),
                    3,
                ),
                "relativeDrift": [
                    relative_drift(reference, transcript)
                    for transcript in batch_runs[-1]["transcripts"]
                ],
            }
        )

    report = {
        "measuredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": MODEL_ID,
        "device": torch.cuda.get_device_name(0),
        "hip": torch.version.hip,
        "modelLoadSeconds": round(model_load_seconds, 3),
        "referenceTranscript": reference,
        "runsPerMode": args.runs,
        "matrix": matrix,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
