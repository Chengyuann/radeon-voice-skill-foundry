#!/usr/bin/env python3
"""Build the W7900 Quark quantization v11 summary from raw evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from statistics import median


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def all_samples(report: dict) -> list[dict]:
    return [
        *report["inference"]["lengthRuns"],
        *[
            request
            for row in report["inference"]["concurrencyRuns"]
            for burst in row["bursts"]
            for request in burst["requests"]
        ],
    ]


def telemetry_summary(path: Path) -> dict:
    values = {
        "gpuUsePercent": [],
        "vramUsedBytes": [],
        "powerW": [],
    }
    patterns = {
        "gpuUsePercent": r"GPU use \(%\): ([0-9.]+)",
        "vramUsedBytes": r"VRAM Total Used Memory \(B\): ([0-9]+)",
        "powerW": r"Average Graphics Package Power \(W\): ([0-9.]+)",
    }
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = json.loads(line)["raw"]
        for key, pattern in patterns.items():
            match = re.search(pattern, raw)
            if match:
                values[key].append(float(match.group(1)))
    return {
        key: {"median": median(samples), "max": max(samples)}
        for key, samples in values.items()
        if samples
    }


def variant_summary(report: dict, telemetry: Path) -> dict:
    samples = all_samples(report)
    return {
        "precision": report["precision"],
        "quantization": report["quantization"],
        "modelDirectoryBytes": report["modelDirectoryBytes"],
        "concurrency": {
            str(row["concurrency"]): {
                "wallMs": row["medianWallMs"],
                "aggregateOutputTokensPerSecond":
                    row["medianAggregateOutputTokensPerSecond"],
            }
            for row in report["inference"]["concurrencyRuns"]
        },
        "semanticGatePassCount": sum(
            all(sample["semanticGate"].values()) for sample in samples
        ),
        "semanticGateTotal": len(samples),
        "semanticGatePassRate": round(
            sum(all(sample["semanticGate"].values()) for sample in samples)
            / len(samples),
            4,
        ),
        "jsonValidCount": sum(
            sample.get("jsonValid", False) for sample in samples
        ),
        "jsonValidRate": (
            round(
                sum(sample["jsonValid"] for sample in samples)
                / len(samples),
                4,
            )
            if all("jsonValid" in sample for sample in samples)
            else None
        ),
        "gatePassCounts": {
            key: sum(sample["semanticGate"][key] for sample in samples)
            for key in samples[0]["semanticGate"]
        },
        "telemetry": telemetry_summary(telemetry),
    }


def percent_change(before: float, after: float) -> float:
    return round((after / before - 1) * 100, 2)


def percent_reduction(before: float, after: float) -> float:
    return round((1 - after / before) * 100, 2)


def parse_gib(log: str, pattern: str) -> float:
    match = re.search(pattern, log)
    if not match:
        raise ValueError(f"Missing log measurement: {pattern}")
    return float(match.group(1))


def parse_int(log: str, pattern: str) -> int:
    match = re.search(pattern, log)
    if not match:
        raise ValueError(f"Missing log measurement: {pattern}")
    return int(match.group(1).replace(",", ""))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-dir", type=Path, default=Path("benchmarks"))
    parser.add_argument("--log-dir", type=Path, required=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("benchmarks/quantization-v11-summary.json"),
    )
    args = parser.parse_args()

    files = {
        "fp16": args.evidence_dir / "quantization-v11-fp16.json",
        "fp16Telemetry":
            args.evidence_dir / "quantization-v11-fp16-telemetry.jsonl",
        "int8C16Eager":
            args.evidence_dir / "quantization-v11-int8-c16-eager.json",
        "int8C16EagerTelemetry":
            args.evidence_dir
            / "quantization-v11-int8-c16-eager-telemetry.jsonl",
        "int8C16Graph":
            args.evidence_dir / "quantization-v11-int8-c16-graph.json",
        "int8C16GraphTelemetry":
            args.evidence_dir
            / "quantization-v11-int8-c16-graph-telemetry.jsonl",
        "int8C128Eager":
            args.evidence_dir / "quantization-v11-int8-c128-eager.json",
        "int8C128EagerTelemetry":
            args.evidence_dir
            / "quantization-v11-int8-c128-eager-telemetry.jsonl",
    }
    logs = {
        "fp16Server": args.log_dir / "rvsf-v11-fp16-final-server.log",
        "int4Server": args.log_dir / "rvsf-v11-int4-server.log",
        "int8C128Server": args.log_dir / "rvsf-v11-int8-c128-server.log",
    }
    reports = {
        key: read_json(files[key])
        for key in ["fp16", "int8C16Eager", "int8C16Graph", "int8C128Eager"]
    }
    variants = {
        "vllmFp16Eager": variant_summary(
            reports["fp16"], files["fp16Telemetry"]
        ),
        "quarkInt8C16Eager": variant_summary(
            reports["int8C16Eager"], files["int8C16EagerTelemetry"]
        ),
        "quarkInt8C16Graph": variant_summary(
            reports["int8C16Graph"], files["int8C16GraphTelemetry"]
        ),
        "quarkInt8C128Eager": variant_summary(
            reports["int8C128Eager"], files["int8C128EagerTelemetry"]
        ),
    }

    fp16 = variants["vllmFp16Eager"]
    int8 = variants["quarkInt8C128Eager"]
    fp16_log = logs["fp16Server"].read_text(encoding="utf-8", errors="replace")
    int4_log = logs["int4Server"].read_text(encoding="utf-8", errors="replace")
    int8_log = logs["int8C128Server"].read_text(
        encoding="utf-8", errors="replace"
    )
    fp16_load_gib = parse_gib(
        fp16_log,
        r"Model loading took ([0-9.]+) GiB memory",
    )
    int8_load_gib = parse_gib(
        int8_log,
        r"Model loading took ([0-9.]+) GiB memory",
    )
    fp16_kv_tokens = parse_int(
        fp16_log,
        r"GPU KV cache size: ([0-9,]+) tokens",
    )
    int8_kv_tokens = parse_int(
        int8_log,
        r"GPU KV cache size: ([0-9,]+) tokens",
    )
    fp16_max_concurrency = parse_gib(
        fp16_log,
        r"Maximum concurrency for 4,096 tokens per request: ([0-9.]+)x",
    )
    int8_max_concurrency = parse_gib(
        int8_log,
        r"Maximum concurrency for 4,096 tokens per request: ([0-9.]+)x",
    )

    summary = {
        "schemaVersion": "0.1.0",
        "measuredAt": reports["int8C128Eager"]["measuredAt"],
        "hardware": reports["fp16"]["environment"]["gpu"],
        "model": reports["fp16"]["model"],
        "variants": variants,
        "comparison": {
            "int8C128VsFp16Concurrency8ThroughputX": round(
                int8["concurrency"]["8"]["aggregateOutputTokensPerSecond"]
                / fp16["concurrency"]["8"]["aggregateOutputTokensPerSecond"],
                3,
            ),
            "int8C128VsFp16Concurrency8ThroughputChangePercent":
                percent_change(
                    fp16["concurrency"]["8"][
                        "aggregateOutputTokensPerSecond"
                    ],
                    int8["concurrency"]["8"][
                        "aggregateOutputTokensPerSecond"
                    ],
                ),
            "int8ModelDirectoryReductionPercent": percent_reduction(
                fp16["modelDirectoryBytes"], int8["modelDirectoryBytes"]
            ),
            "modelLoadVramReductionPercent": percent_reduction(
                fp16_load_gib, int8_load_gib
            ),
            "kvCacheIncreasePercent": percent_change(
                fp16_kv_tokens, int8_kv_tokens
            ),
            "semanticGatePreserved": False,
            "productionDecision": "reject-int8-for-policy-compiler",
        },
        "compatibility": {
            "quarkVersion": "0.12.post1",
            "vllmVersion":
                "0.16.1.dev0+g89a77b108.d20260317.rocm721",
            "gpuArchitecture": "gfx1100",
            "int4WeightOnlyExport": {
                "status": "exported",
                "sourceBytes": fp16["modelDirectoryBytes"],
                "exportBytes": 2_681_915_748,
                "reductionPercent": percent_reduction(
                    fp16["modelDirectoryBytes"], 2_681_915_748
                ),
                "servingStatus": "rejected",
                "reason":
                    "vLLM Quark loader has no compatible W4A16 weight-only "
                    "scheme for signed INT4 per-group group_size=128.",
                "loaderErrorObserved": any(
                    "No quark compatible scheme was found" in line
                    for line in int4_log.splitlines()
                ),
            },
            "int8W8A8": {
                "status": "served",
                "kernel": "TritonInt8ScaledMMLinearKernel",
                "modelLoadGiB": int8_load_gib,
                "fp16ModelLoadGiB": fp16_load_gib,
                "kvCacheTokens": int8_kv_tokens,
                "fp16KvCacheTokens": fp16_kv_tokens,
                "maxConcurrency4096": int8_max_concurrency,
                "fp16MaxConcurrency4096": fp16_max_concurrency,
            },
            "fp8": {
                "status": "not_run",
                "reason":
                    "Registered loader is not evidence of a native "
                    "accelerated FP8 matrix path on RDNA3 gfx1100.",
            },
        },
        "rawEvidence": {
            path.name: {"sha256": sha256(path)}
            for path in [*files.values(), *logs.values()]
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
