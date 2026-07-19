#!/usr/bin/env python3
"""Run reproducible W7900 experiments in an isolated Radeon Cloud workspace."""

from __future__ import annotations

import argparse
import concurrent.futures
import difflib
import hashlib
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path
from statistics import median
from urllib import request

import numpy as np
import soundfile as sf


DEFAULT_MODEL = "Qwen/Qwen3-4B-Instruct-2507"
DEFAULT_ASR_MODEL = "Qwen/Qwen3-ASR-0.6B"
REFERENCE_TRANSCRIPT = (
    "项目评审之后，之处理P零和P一问题。外部报告里不能包含薪资数据。"
    "邮件只能生成草稿，不要自动发送。如果负责人缺失，必须标记为需要确认。"
    "只有存在截止日期时，才创建日历站位。"
)


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=check,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )


def command_output(command: list[str]) -> str:
    try:
        return run(command).stdout.strip()
    except Exception as error:
        return f"{type(error).__name__}: {error}"


class TelemetrySampler:
    def __init__(self, output: Path) -> None:
        self.output = output
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def __enter__(self) -> "TelemetrySampler":
        self.output.parent.mkdir(parents=True, exist_ok=True)
        self.thread.start()
        return self

    def __exit__(self, *_args: object) -> None:
        self.stop_event.set()
        self.thread.join(timeout=5)

    def _run(self) -> None:
        with self.output.open("a", encoding="utf-8") as handle:
            while not self.stop_event.is_set():
                result = command_output(
                    [
                        "bash",
                        "-lc",
                        "rocm-smi --showuse --showmeminfo vram --showtemp "
                        "--showpower 2>/dev/null",
                    ]
                )
                handle.write(
                    json.dumps(
                        {
                            "at": time.time(),
                            "raw": result,
                        }
                    )
                    + "\n"
                )
                handle.flush()
                self.stop_event.wait(1)


def gpu_snapshot() -> dict:
    try:
        import torch

        properties = torch.cuda.get_device_properties(0)
        return {
            "torch": torch.__version__,
            "hip": torch.version.hip,
            "device": torch.cuda.get_device_name(0),
            "architecture": getattr(properties, "gcnArchName", None),
            "totalVramBytes": properties.total_memory,
            "allocatedVramBytes": torch.cuda.memory_allocated(),
            "reservedVramBytes": torch.cuda.memory_reserved(),
        }
    except Exception as error:
        return {"error": f"{type(error).__name__}: {error}"}


def environment_snapshot() -> dict:
    package_names = [
        "torch",
        "transformers",
        "qwen-asr",
        "vllm",
        "flash-attn",
        "triton",
        "accelerate",
    ]
    packages = {}
    for name in package_names:
        output = command_output(
            [sys.executable, "-m", "pip", "show", name]
        )
        version = next(
            (
                line.split(":", 1)[1].strip()
                for line in output.splitlines()
                if line.startswith("Version:")
            ),
            None,
        )
        packages[name] = version
    return {
        "measuredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "platform": platform.platform(),
        "python": sys.version,
        "cwd": str(Path.cwd()),
        "gpu": gpu_snapshot(),
        "rocmSmi": command_output(
            [
                "bash",
                "-lc",
                "rocm-smi --showproductname --showmeminfo vram --showuse "
                "--showtemp --showpower 2>/dev/null | head -80",
            ]
        ),
        "processes": command_output(
            [
                "bash",
                "-lc",
                "ps -eo pid,etime,%cpu,%mem,cmd | "
                "grep -E 'radeon_(model|asr)_server|vllm' | grep -v grep",
            ]
        ),
        "disk": command_output(["bash", "-lc", "df -h /workspace /root | head -10"]),
        "packages": packages,
    }


def post_json(url: str, payload: dict, timeout: float = 180) -> dict:
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    with request.urlopen(req, timeout=timeout) as response:
        result = json.loads(response.read().decode("utf-8"))
    result["_httpMs"] = round((time.perf_counter() - started) * 1000, 2)
    return result


def streaming_completion(url: str, payload: dict, timeout: float = 180) -> dict:
    streamed_payload = {
        **payload,
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    req = request.Request(
        url,
        data=json.dumps(streamed_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    with request.urlopen(req, timeout=timeout) as response:
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" not in content_type:
            result = json.loads(response.read().decode("utf-8"))
            result["_httpMs"] = round((time.perf_counter() - started) * 1000, 2)
            return result

        first_token_at = None
        parts: list[str] = []
        usage: dict = {}
        for raw_line in response:
            line = raw_line.decode("utf-8").strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            chunk = json.loads(data)
            usage = chunk.get("usage") or usage
            choices = chunk.get("choices") or []
            delta = (
                choices[0].get("delta", {}).get("content", "")
                if choices
                else ""
            )
            if delta:
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                parts.append(delta)
        ended = time.perf_counter()
    output_tokens = int(usage.get("completion_tokens") or 0)
    input_tokens = int(usage.get("prompt_tokens") or 0)
    elapsed = max(ended - started, 1e-9)
    return {
        "choices": [{"message": {"content": "".join(parts)}}],
        "usage": usage,
        "metrics": {
            "ttftMs": round(((first_token_at or ended) - started) * 1000, 2),
            "generationMs": round(elapsed * 1000, 2),
            "tokensPerSecond": round(output_tokens / elapsed, 2),
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "peakVramGiB": None,
        },
        "_httpMs": round(elapsed * 1000, 2),
    }


def prompt_for_tokens(target_tokens: int) -> str:
    rule = (
        "Only retain P0 and P1 findings. Redact compensation data. Draft email "
        "but never send automatically. Missing owner requires confirmation. "
        "Create a calendar hold only when a due date exists. "
    )
    repetitions = max(1, math.ceil(target_tokens / 38))
    return (
        "Extract the enforceable constraints from this SOP as compact JSON. "
        + rule * repetitions
    )


def inference_request(
    model_url: str,
    model: str,
    input_target: int,
    output_target: int,
    variation: int = 0,
) -> dict:
    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": output_target,
        "chat_template_kwargs": {"enable_thinking": False},
        "messages": [
            {
                "role": "system",
                "content": (
                    "Return compact JSON with atomic SOP constraints. Preserve "
                    "redaction, no-send, missing-owner confirmation, and due-date-only rules."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Scenario variation {variation}: "
                    f"{prompt_for_tokens(input_target)}"
                ),
            },
        ],
    }
    result = streaming_completion(
        f"{model_url.rstrip('/')}/chat/completions",
        payload,
    )
    metrics = result.get("metrics", {})
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        parsed_content = json.loads(content)
        json_valid = isinstance(parsed_content, (dict, list))
    except json.JSONDecodeError:
        json_valid = False
    return {
        "inputTargetTokens": input_target,
        "outputTargetTokens": output_target,
        "variation": variation,
        "httpMs": result["_httpMs"],
        "metrics": metrics,
        "content": content,
        "contentSha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "jsonValid": json_valid,
        "semanticGate": {
            "hasRedaction": "redact" in content.lower()
            or "compensation" in content.lower(),
            "hasNoSend": "send" in content.lower()
            and any(word in content.lower() for word in ["not", "never", "deny"]),
            "hasConfirmation": "confirm" in content.lower(),
            "hasDueDateCondition": "due date" in content.lower()
            or "only_if" in content.lower(),
        },
    }


def run_inference_matrix(model_url: str, model: str) -> dict:
    health_url = f"{model_url.removesuffix('/v1')}/health"
    with request.urlopen(health_url, timeout=30) as response:
        body = response.read().decode("utf-8").strip()
        health = (
            json.loads(body)
            if body
            else {"ok": True, "status": response.status}
        )
    length_runs = []
    for input_target in [256, 1024, 3072]:
        for _ in range(2):
            length_runs.append(
                inference_request(model_url, model, input_target, 160)
            )

    concurrency_runs = []
    for concurrency in [1, 2, 4, 8]:
        bursts = []
        for burst_index in range(3):
            started = time.perf_counter()
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=concurrency
            ) as executor:
                futures = [
                    executor.submit(
                        inference_request,
                        model_url,
                        model,
                        512,
                        128,
                        1000 + burst_index * 100 + request_index,
                    )
                    for request_index in range(concurrency)
                ]
                results = [future.result() for future in futures]
            wall_seconds = time.perf_counter() - started
            total_output_tokens = sum(
                result["metrics"].get("outputTokens", 0) for result in results
            )
            bursts.append(
                {
                    "wallMs": round(wall_seconds * 1000, 2),
                    "aggregateOutputTokensPerSecond": round(
                        total_output_tokens / max(wall_seconds, 1e-9), 2
                    ),
                    "requests": results,
                }
            )
        concurrency_runs.append(
            {
                "concurrency": concurrency,
                "medianWallMs": median(burst["wallMs"] for burst in bursts),
                "medianAggregateOutputTokensPerSecond": median(
                    burst["aggregateOutputTokensPerSecond"] for burst in bursts
                ),
                "bursts": bursts,
            }
        )

    return {
        "health": health,
        "lengthRuns": length_runs,
        "concurrencyRuns": concurrency_runs,
    }


def normalize_text(text: str) -> str:
    return "".join(
        character.lower()
        for character in text
        if character.isalnum()
    )


def character_error_rate(reference: str, hypothesis: str) -> float:
    ref = normalize_text(reference)
    hyp = normalize_text(hypothesis)
    matcher = difflib.SequenceMatcher(None, ref, hyp, autojunk=False)
    matches = sum(block.size for block in matcher.get_matching_blocks())
    distance = max(len(ref), len(hyp)) - matches
    return round(distance / max(len(ref), 1), 4)


def fft_convolve(signal: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    length = len(signal) + len(kernel) - 1
    spectrum_size = 1 << (length - 1).bit_length()
    result = np.fft.irfft(
        np.fft.rfft(signal, spectrum_size) * np.fft.rfft(kernel, spectrum_size),
        spectrum_size,
    )[:length]
    return result.astype(np.float32)


def reverb_kernel(sample_rate: int, rt60: float) -> np.ndarray:
    length = max(1, int(sample_rate * rt60))
    time_axis = np.arange(length, dtype=np.float32) / sample_rate
    decay = np.exp(-6.91 * time_axis / max(rt60, 0.05))
    kernel = np.zeros(length, dtype=np.float32)
    kernel[0] = 1
    rng = np.random.default_rng(20260718 + int(rt60 * 100))
    reflections = rng.normal(0, 1, length).astype(np.float32) * decay
    kernel += 0.035 * reflections
    for delay_ms, gain in [(18, 0.35), (37, 0.24), (61, 0.17), (94, 0.11)]:
        index = min(length - 1, int(sample_rate * delay_ms / 1000))
        kernel[index] += gain
    kernel /= max(np.sum(np.abs(kernel)), 1e-9)
    return kernel


def add_noise(signal: np.ndarray, snr_db: float, rng: np.random.Generator) -> np.ndarray:
    signal_rms = math.sqrt(float(np.mean(signal**2)) + 1e-12)
    noise = rng.normal(0, 1, len(signal)).astype(np.float32)
    noise_rms = math.sqrt(float(np.mean(noise**2)) + 1e-12)
    target_noise_rms = signal_rms / (10 ** (snr_db / 20))
    return signal + noise * (target_noise_rms / max(noise_rms, 1e-9))


def perturb_audio(
    audio: np.ndarray,
    sample_rate: int,
    kind: str,
) -> np.ndarray:
    rng = np.random.default_rng(20260718)
    result = audio.astype(np.float32).copy()
    if kind.startswith("noise_"):
        result = add_noise(result, float(kind.split("_")[1]), rng)
    elif kind.startswith("reverb_"):
        result = fft_convolve(
            result,
            reverb_kernel(sample_rate, float(kind.split("_")[1])),
        )[: len(result)]
    elif kind == "far_field":
        result *= 0.18
        result = add_noise(result, 12, rng)
        result = fft_convolve(result, reverb_kernel(sample_rate, 0.45))[: len(result)]
    elif kind == "clipped":
        result *= 4.5
        result = np.clip(result, -1.0, 1.0)
    elif kind.startswith("dropout_"):
        dropout_ms = float(kind.split("_")[1])
        frame = max(1, int(sample_rate * dropout_ms / 1000))
        spacing = 2.7 if dropout_ms <= 40 else 1.5 if dropout_ms <= 120 else 1.1
        for start in range(int(sample_rate * 1.3), len(result), int(sample_rate * spacing)):
            result[start : start + frame] = 0
    peak = float(np.max(np.abs(result))) or 1
    if kind != "clipped" and peak > 0.99:
        result *= 0.99 / peak
    return result.astype(np.float32)


def multipart_audio_request(app_url: str, audio_path: Path) -> dict:
    boundary = f"----rvsf-{uuid.uuid4().hex}"
    header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="audio"; filename="{audio_path.name}"\r\n'
        "Content-Type: audio/wav\r\n\r\n"
    ).encode("utf-8")
    body = header + audio_path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = request.Request(
        f"{app_url.rstrip('/')}/api/transcribe",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=240) as response:
        return json.loads(response.read().decode("utf-8"))


def run_asr_matrix(app_url: str, audio_path: Path, work_dir: Path) -> dict:
    audio, sample_rate = sf.read(
        audio_path,
        dtype="float32",
        always_2d=False,
    )
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    perturbations = [
        "clean",
        "noise_20",
        "noise_10",
        "noise_5",
        "reverb_0.25",
        "reverb_0.55",
        "far_field",
        "clipped",
        "dropout_40",
        "dropout_120",
        "dropout_280",
    ]
    results = []
    work_dir.mkdir(parents=True, exist_ok=True)
    for kind in perturbations:
        output = work_dir / f"{kind}.wav"
        sf.write(
            output,
            audio if kind == "clean" else perturb_audio(audio, sample_rate, kind),
            sample_rate,
            subtype="PCM_16",
        )
        samples = []
        for _ in range(2):
            response = multipart_audio_request(app_url, output)
            response["relativeCharacterDrift"] = character_error_rate(
                REFERENCE_TRANSCRIPT,
                response.get("transcript", ""),
            )
            samples.append(response)
        results.append(
            {
                "condition": kind,
                "samples": samples,
                "medianRtf": median(sample["rtf"] for sample in samples),
                "medianRelativeCharacterDrift": median(
                    sample["relativeCharacterDrift"] for sample in samples
                ),
                "voiceEvidence": samples[-1].get("voiceEvidence"),
            }
        )
    return {"referenceTranscript": REFERENCE_TRANSCRIPT, "conditions": results}


def proof_admission(inference: dict, asr: dict, environment: dict) -> dict:
    decisions = []
    for condition in asr["conditions"]:
        drift = condition["medianRelativeCharacterDrift"]
        rtf = condition["medianRtf"]
        if drift <= 0.08 and rtf <= 0.2:
            status = "pass"
        elif drift <= 0.3 and rtf <= 0.45:
            status = "review"
        else:
            status = "quarantine"
        decisions.append(
            {
                "condition": condition["condition"],
                "status": status,
                "reasons": [
                    f"relative_character_drift={drift}",
                    f"rtf={rtf}",
                ],
            }
        )
    semantic_gate_rate = sum(
        all(run["semanticGate"].values())
        for run in inference["lengthRuns"]
    ) / max(len(inference["lengthRuns"]), 1)
    runtime_compatible = (
        environment.get("gpu", {}).get("architecture") == "gfx1100"
        and str(environment.get("gpu", {}).get("hip", "")).startswith("7.2")
    )
    return {
        "schemaVersion": "0.1.0",
        "innovation": "Proof Admission Controller",
        "runtimeCompatible": runtime_compatible,
        "semanticGatePassRate": round(semantic_gate_rate, 4),
        "audioDecisions": decisions,
        "policy": {
            "pass": "Promote only when audio stability and runtime proof are compatible.",
            "review": "Require human transcript acknowledgement before compilation.",
            "quarantine": "Block skill promotion and retain only diagnostic metadata.",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=Path("/workspace/rvsf-weekend"))
    parser.add_argument("--model-url", default="http://127.0.0.1:8000/v1")
    parser.add_argument("--asr-url", default="http://127.0.0.1:8001")
    parser.add_argument("--app-url", default="http://127.0.0.1:8793")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--audio", type=Path, default=Path("/workspace/voice-sop-zh.wav"))
    parser.add_argument(
        "--phase",
        choices=["snapshot", "inference", "asr", "all"],
        default="all",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    environment_path = args.output_dir / "environment.json"
    if args.phase in {"snapshot", "all"} or not environment_path.exists():
        environment_path.write_text(
            json.dumps(environment_snapshot(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    environment = json.loads(environment_path.read_text(encoding="utf-8"))

    inference_path = args.output_dir / "inference-matrix.json"
    if args.phase in {"inference", "all"}:
        with TelemetrySampler(args.output_dir / "telemetry-inference.jsonl"):
            inference_path.write_text(
                json.dumps(
                    run_inference_matrix(args.model_url, args.model),
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
    inference = (
        json.loads(inference_path.read_text(encoding="utf-8"))
        if inference_path.exists()
        else {}
    )

    asr_path = args.output_dir / "asr-robustness.json"
    if args.phase in {"asr", "all"}:
        with TelemetrySampler(args.output_dir / "telemetry-asr.jsonl"):
            asr_path.write_text(
                json.dumps(
                    run_asr_matrix(
                        args.app_url,
                        args.audio,
                        args.output_dir / "audio-variants",
                    ),
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
    asr = (
        json.loads(asr_path.read_text(encoding="utf-8"))
        if asr_path.exists()
        else {}
    )

    if inference and asr:
        (args.output_dir / "proof-admission-controller.json").write_text(
            json.dumps(
                proof_admission(inference, asr, environment),
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    print(args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
