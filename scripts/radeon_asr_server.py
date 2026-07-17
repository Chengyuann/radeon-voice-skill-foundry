#!/usr/bin/env python3
"""Persistent Qwen3-ASR service for Radeon Cloud."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock

import torch
import soundfile as sf
from qwen_asr import Qwen3ASRModel


MODEL_ID = os.getenv("ASR_MODEL_ID", "Qwen/Qwen3-ASR-0.6B")
HOST = os.getenv("ASR_HOST", "0.0.0.0")
PORT = int(os.getenv("ASR_PORT", "8001"))
MODEL_LOCK = Lock()

print(f"Loading {MODEL_ID} on Radeon GPU...", flush=True)
LOAD_STARTED = time.perf_counter()
MODEL = Qwen3ASRModel.from_pretrained(
    MODEL_ID,
    dtype=torch.float16,
    device_map="cuda:0",
    max_inference_batch_size=8,
    max_new_tokens=256,
)
LOAD_SECONDS = time.perf_counter() - LOAD_STARTED
print(
    json.dumps(
        {
            "event": "asr_loaded",
            "model": MODEL_ID,
            "loadSeconds": round(LOAD_SECONDS, 3),
            "device": torch.cuda.get_device_name(0),
        }
    ),
    flush=True,
)


class Handler(BaseHTTPRequestHandler):
    server_version = "RadeonASRServer/0.1"

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            self._json(
                200,
                {
                    "ok": True,
                    "model": MODEL_ID,
                    "device": torch.cuda.get_device_name(0),
                    "hip": torch.version.hip,
                    "loadSeconds": round(LOAD_SECONDS, 3),
                },
            )
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/transcribe":
            self._json(404, {"error": "not found"})
            return

        path: Path | None = None
        wav_path: Path | None = None
        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > 100 * 1024 * 1024:
                raise ValueError("invalid audio content length")
            filename = self.headers.get("x-filename", "audio.bin")
            suffix = Path(filename).suffix or ".bin"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
                handle.write(self.rfile.read(length))
                path = Path(handle.name)

            wav_path = ensure_wav(path)
            audio_seconds = probe_duration(wav_path)
            with MODEL_LOCK:
                torch.cuda.reset_peak_memory_stats()
                torch.cuda.synchronize()
                started = time.perf_counter()
                result = MODEL.transcribe(
                    audio=str(wav_path),
                    language="Chinese",
                    return_time_stamps=False,
                )[0]
                torch.cuda.synchronize()
                elapsed = time.perf_counter() - started

            self._json(
                200,
                {
                    "transcript": result.text,
                    "language": result.language,
                    "audioSeconds": round(audio_seconds, 4),
                    "inferenceMs": round(elapsed * 1000, 2),
                    "rtf": round(elapsed / max(audio_seconds, 1e-9), 4),
                    "xRealtime": round(audio_seconds / max(elapsed, 1e-9), 2),
                    "peakVramGiB": round(
                        torch.cuda.max_memory_allocated() / 1024**3, 3
                    ),
                },
            )
        except Exception as exc:  # noqa: BLE001
            self._json(
                400,
                {"error": f"{type(exc).__name__}: {exc}"},
            )
        finally:
            for candidate in {path, wav_path}:
                if candidate and candidate.exists():
                    candidate.unlink(missing_ok=True)

    def log_message(self, fmt: str, *args: object) -> None:
        print(
            json.dumps(
                {"event": "asr_http", "message": fmt % args}
            ),
            flush=True,
        )

    def _json(self, status: int, payload: object) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def ensure_wav(path: Path) -> Path:
    if path.suffix.lower() == ".wav":
        return path
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "This Radeon image has no ffmpeg. Upload WAV audio or install ffmpeg for webm/mp3."
        )
    target = path.with_suffix(".wav")
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(path),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(target),
        ],
        check=True,
    )
    return target


def probe_duration(path: Path) -> float:
    try:
        info = sf.info(path)
        if info.duration > 0:
            return float(info.duration)
    except Exception:
        pass
    if shutil.which("ffprobe") is None:
        raise RuntimeError("Unable to determine audio duration without ffprobe")
    result = subprocess.run(
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
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    )
    return float(result.stdout.strip())


if __name__ == "__main__":
    print(f"Listening on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
