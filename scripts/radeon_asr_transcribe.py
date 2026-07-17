#!/usr/bin/env python3
"""Transcribe one uploaded audio file with Qwen3-ASR on Radeon."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from qwen_asr import Qwen3ASRModel


MODEL_ID = "Qwen/Qwen3-ASR-0.6B"

_MODEL: Qwen3ASRModel | None = None


def get_model() -> Qwen3ASRModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = Qwen3ASRModel.from_pretrained(
            MODEL_ID,
            dtype=torch.float16,
            device_map="cuda:0",
            max_inference_batch_size=8,
            max_new_tokens=256,
        )
    return _MODEL


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: radeon_asr_transcribe.py <audio-file>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    audio, sample_rate = sf.read(path, dtype="float32", always_2d=False)
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    audio_seconds = float(len(audio) / sample_rate)

    model = get_model()
    torch.cuda.reset_peak_memory_stats()
    torch.cuda.synchronize()
    started = time.perf_counter()
    result = model.transcribe(
        audio=(audio, int(sample_rate)),
        language="Chinese",
        return_time_stamps=False,
    )[0]
    torch.cuda.synchronize()
    elapsed = time.perf_counter() - started

    print(
        json.dumps(
            {
                "transcript": result.text,
                "language": result.language,
                "audioSeconds": round(audio_seconds, 4),
                "inferenceMs": round(elapsed * 1000, 2),
                "rtf": round(elapsed / max(audio_seconds, 1e-9), 4),
                "xRealtime": round(audio_seconds / max(elapsed, 1e-9), 2),
                "peakVramGiB": round(torch.cuda.max_memory_allocated() / 1024**3, 3),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
