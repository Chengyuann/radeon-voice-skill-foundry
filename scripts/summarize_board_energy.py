#!/usr/bin/env python3
"""Integrate W7900 board-power telemetry for the fixed serving workload."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


POWER_RE = re.compile(
    r"Average Graphics Package Power \(W\): ([0-9.]+)"
)


def workload(path: Path) -> tuple[int, int]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    requests = 0
    output_tokens = 0
    for row in payload["lengthRuns"]:
        requests += 1
        output_tokens += int(row["metrics"]["outputTokens"])
    for concurrency in payload["concurrencyRuns"]:
        for burst in concurrency["bursts"]:
            for row in burst["requests"]:
                requests += 1
                output_tokens += int(row["metrics"]["outputTokens"])
    return requests, output_tokens


def telemetry(path: Path) -> dict:
    samples: list[tuple[float, float]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        match = POWER_RE.search(row["raw"])
        if match:
            samples.append((float(row["at"]), float(match.group(1))))
    if len(samples) < 2:
        raise ValueError(f"insufficient power samples: {path}")
    energy_joules = sum(
        (samples[index - 1][1] + samples[index][1])
        / 2
        * (samples[index][0] - samples[index - 1][0])
        for index in range(1, len(samples))
    )
    duration_seconds = samples[-1][0] - samples[0][0]
    return {
        "sampleCount": len(samples),
        "durationSeconds": round(duration_seconds, 3),
        "integratedBoardEnergyJoules": round(energy_joules, 2),
        "averageBoardPowerWatts": round(
            energy_joules / duration_seconds, 2
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    inputs = {
        "transformersFp16": (
            root / "benchmarks/weekend-v10-transformers-extended.json",
            root
            / "benchmarks/weekend-v10-transformers-extended-telemetry.jsonl",
        ),
        "vllmEagerFp16": (
            root / "benchmarks/weekend-v10-vllm-eager-extended.json",
            root
            / "benchmarks/weekend-v10-vllm-eager-extended-telemetry.jsonl",
        ),
        "vllmGraphFp16": (
            root / "benchmarks/weekend-v10-vllm-graph-extended.json",
            root
            / "benchmarks/weekend-v10-vllm-graph-extended-telemetry.jsonl",
        ),
    }
    variants = {}
    for name, (workload_path, telemetry_path) in inputs.items():
        request_count, output_tokens = workload(workload_path)
        measured = telemetry(telemetry_path)
        energy = measured["integratedBoardEnergyJoules"]
        variants[name] = {
            "requestCount": request_count,
            "outputTokens": output_tokens,
            **measured,
            "outputTokensPerBoardJoule": round(output_tokens / energy, 4),
        }
    counts = {row["requestCount"] for row in variants.values()}
    if counts != {51}:
        raise ValueError(f"workload request counts do not match: {counts}")

    baseline = variants["transformersFp16"]
    graph = variants["vllmGraphFp16"]
    summary = {
        "schemaVersion": "0.1.0",
        "title": "W7900 Fixed-Workload Board-Energy Integration",
        "hardware": "AMD Radeon Pro W7900-class gfx1100 48GB",
        "runtime": "ROCm 7.2.1",
        "workload": (
            "Identical 51-request serving sweep: six length requests plus "
            "three bursts at concurrency 1, 2, 4, and 8"
        ),
        "integration": (
            "Trapezoidal integration of rocm-smi Average Graphics Package "
            "Power samples over each complete extended workload"
        ),
        "variants": variants,
        "comparison": {
            "vllmGraphVsTransformersOutputTokensPerBoardJouleX": round(
                graph["outputTokensPerBoardJoule"]
                / baseline["outputTokensPerBoardJoule"],
                2,
            ),
            "vllmGraphVsTransformersBoardEnergyReductionPercent": round(
                (
                    1
                    - graph["integratedBoardEnergyJoules"]
                    / baseline["integratedBoardEnergyJoules"]
                )
                * 100,
                2,
            ),
        },
        "qualityBoundary": (
            "All requests retained the four required safety semantics in the "
            "source benchmark reports."
        ),
        "measurementBoundary": (
            "Board-level GPU package energy only. The fixed workload ran with "
            "the same resident production ASR and Transformers services; vLLM "
            "variants added their own server. CPU, RAM, storage, cooling, and "
            "datacenter PUE are excluded. This is a bounded application "
            "comparison, not whole-system energy certification."
        ),
        "sourceEvidence": [
            str(path.relative_to(root))
            for pair in inputs.values()
            for path in pair
        ],
    }
    output_path = (
        args.output
        if args.output.is_absolute()
        else root / args.output
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
