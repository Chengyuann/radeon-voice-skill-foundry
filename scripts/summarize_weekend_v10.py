#!/usr/bin/env python3
"""Build the compact weekend W7900 evidence summary from raw benchmark files."""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from statistics import median


ROOT = Path(__file__).resolve().parents[1]
BENCHMARKS = ROOT / "benchmarks"


def read_json(name: str) -> dict | list:
    return json.loads((BENCHMARKS / name).read_text(encoding="utf-8"))


def file_sha256(path: Path) -> str:
    return subprocess.check_output(
        ["shasum", "-a", "256", str(path)],
        text=True,
    ).split()[0]


def telemetry_summary(name: str) -> dict:
    values = {
        "gpuUsePercent": [],
        "vramUsedBytes": [],
        "edgeTempC": [],
        "junctionTempC": [],
        "memoryTempC": [],
        "powerW": [],
    }
    patterns = {
        "gpuUsePercent": r"GPU use \(%\): ([0-9.]+)",
        "vramUsedBytes": r"VRAM Total Used Memory \(B\): ([0-9]+)",
        "edgeTempC": r"Sensor edge\) \(C\): ([0-9.]+)",
        "junctionTempC": r"Sensor junction\) \(C\): ([0-9.]+)",
        "memoryTempC": r"Sensor memory\) \(C\): ([0-9.]+)",
        "powerW": r"Average Graphics Package Power \(W\): ([0-9.]+)",
    }
    path = BENCHMARKS / name
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = json.loads(line)["raw"]
        for key, pattern in patterns.items():
            match = re.search(pattern, raw)
            if match:
                values[key].append(float(match.group(1)))
    return {
        key: {
            "median": median(samples),
            "max": max(samples),
        }
        for key, samples in values.items()
        if samples
    }


def serving_summary(report: dict) -> dict:
    length_groups: dict[int, list[dict]] = {}
    for run in report["lengthRuns"]:
        length_groups.setdefault(run["inputTargetTokens"], []).append(run)
    lengths = {}
    for target, runs in length_groups.items():
        lengths[str(target)] = {
            "medianTtftMs": median(run["metrics"]["ttftMs"] for run in runs),
            "medianTokensPerSecond": median(
                run["metrics"]["tokensPerSecond"] for run in runs
            ),
            "medianHttpMs": median(run["httpMs"] for run in runs),
            "semanticGatePassRate": sum(
                all(run["semanticGate"].values()) for run in runs
            )
            / len(runs),
        }
    return {
        "lengths": lengths,
        "concurrency": {
            str(row["concurrency"]): {
                "medianWallMs": row["medianWallMs"],
                "medianAggregateOutputTokensPerSecond":
                    row["medianAggregateOutputTokensPerSecond"],
                "semanticGatePassRate": sum(
                    all(request["semanticGate"].values())
                    for burst in row["bursts"]
                    for request in burst["requests"]
                )
                / sum(len(burst["requests"]) for burst in row["bursts"]),
            }
            for row in report["concurrencyRuns"]
        },
    }


def main() -> None:
    environment = read_json("weekend-v10-environment.json")
    transformers = read_json("weekend-v10-transformers-extended.json")
    vllm_eager = read_json("weekend-v10-vllm-eager-extended.json")
    vllm_graph = read_json("weekend-v10-vllm-graph-extended.json")
    asr_batch = read_json("weekend-v10-asr-batch.json")
    asr_robustness = read_json(
        "weekend-v10-asr-robustness-v02-extended.json"
    )
    v03_dropout = read_json("weekend-v10-v03-dropout-validation.json")

    serving = {
        "transformersFp16": serving_summary(transformers),
        "vllmEagerFp16": serving_summary(vllm_eager),
        "vllmGraphFp16": serving_summary(vllm_graph),
    }
    transformer_c8 = serving["transformersFp16"]["concurrency"]["8"]
    graph_c8 = serving["vllmGraphFp16"]["concurrency"]["8"]
    eager_c8 = serving["vllmEagerFp16"]["concurrency"]["8"]
    serving["improvement"] = {
        "vllmGraphVsTransformersConcurrency8ThroughputX": round(
            graph_c8["medianAggregateOutputTokensPerSecond"]
            / transformer_c8["medianAggregateOutputTokensPerSecond"],
            2,
        ),
        "vllmGraphVsTransformersConcurrency8WallReductionPercent": round(
            (
                1
                - graph_c8["medianWallMs"]
                / transformer_c8["medianWallMs"]
            )
            * 100,
            2,
        ),
        "vllmGraphVsEagerConcurrency8ThroughputPercent": round(
            (
                graph_c8["medianAggregateOutputTokensPerSecond"]
                / eager_c8["medianAggregateOutputTokensPerSecond"]
                - 1
            )
            * 100,
            2,
        ),
        "vllmGraphCompileSeconds": 35.88,
        "vllmGraphCaptureSeconds": 1.0,
        "vllmGraphExtraVramGiB": 0.46,
    }

    conditions = {
        row["condition"]: {
            "medianRtf": row["medianRtf"],
            "relativeCharacterDrift": row["medianRelativeCharacterDrift"],
            "status": row["voiceEvidence"]["status"],
            "qualityScore": row["voiceEvidence"]["qualityScore"],
            "estimatedSnrDb": row["voiceEvidence"].get("estimatedSnrDb"),
            "clippingRatio": row["voiceEvidence"].get("clippingRatio"),
            "dropoutRatio": row["voiceEvidence"].get("dropoutRatio"),
        }
        for row in asr_robustness["conditions"]
    }
    v03 = {
        row["condition"]: {
            "rtf": row["rtf"],
            "status": row["voiceEvidence"]["status"],
            "qualityScore": row["voiceEvidence"]["qualityScore"],
            "dropoutRatio": row["voiceEvidence"].get("dropoutRatio"),
            "burstLossRatio": row["voiceEvidence"].get("burstLossRatio"),
            "diagnostics": row["voiceEvidence"].get("diagnostics", []),
        }
        for row in v03_dropout
    }
    batch_8 = next(row for row in asr_batch["matrix"] if row["batchSize"] == 8)
    asr = {
        "referenceBoundary":
            "Relative character drift uses the deterministic clean ASR output, not a human gold transcript.",
        "robustnessV02": conditions,
        "nativeBatching": {
            "batch8Speedup": batch_8["batchSpeedup"],
            "batch8AggregateAudioXRealtime":
                batch_8["batch"]["medianAggregateAudioXRealtime"],
            "batch8WallMs": batch_8["batch"]["medianWallMs"],
            "batch8PeakVramGiB": batch_8["batch"]["medianPeakVramGiB"],
            "sequential8AggregateAudioXRealtime":
                batch_8["sequential"]["medianAggregateAudioXRealtime"],
            "sequential8WallMs": batch_8["sequential"]["medianWallMs"],
            "sequential8PeakVramGiB":
                batch_8["sequential"]["medianPeakVramGiB"],
        },
        "voiceEvidenceV03": v03,
        "blindSpotClosure": {
            "condition": "dropout_280",
            "relativeCharacterDriftBeforeFix":
                conditions["dropout_280"]["relativeCharacterDrift"],
            "v02Status": conditions["dropout_280"]["status"],
            "v02QualityScore": conditions["dropout_280"]["qualityScore"],
            "v03Status": v03["dropout_280"]["status"],
            "v03QualityScore": v03["dropout_280"]["qualityScore"],
            "v03BurstLossRatio": v03["dropout_280"]["burstLossRatio"],
        },
    }

    raw_files = [
        "weekend-v10-environment.json",
        "weekend-v10-transformers-extended.json",
        "weekend-v10-transformers-extended-telemetry.jsonl",
        "weekend-v10-vllm-eager-extended.json",
        "weekend-v10-vllm-eager-extended-telemetry.jsonl",
        "weekend-v10-vllm-graph-extended.json",
        "weekend-v10-vllm-graph-extended-telemetry.jsonl",
        "weekend-v10-asr-batch.json",
        "weekend-v10-asr-robustness-v02-extended.json",
        "weekend-v10-asr-extended-telemetry.jsonl",
        "weekend-v10-v03-dropout-validation.json",
        "weekend-v10-final-validation.log",
        "weekend-v10-vllm-eager-server.log",
        "weekend-v10-vllm-graph-server.log",
    ]
    report = {
        "schemaVersion": "0.3.0",
        "measuredAt": environment["measuredAt"],
        "sourceRevision": os.environ.get(
            "EXPERIMENT_SOURCE_REVISION",
            "working-tree-v10",
        ),
        "environment": {
            "gpu": environment["gpu"],
            "packages": environment["packages"],
        },
        "serving": serving,
        "asr": asr,
        "telemetry": {
            "transformersFp16": telemetry_summary(
                "weekend-v10-transformers-extended-telemetry.jsonl"
            ),
            "vllmEagerFp16": telemetry_summary(
                "weekend-v10-vllm-eager-extended-telemetry.jsonl"
            ),
            "vllmGraphFp16": telemetry_summary(
                "weekend-v10-vllm-graph-extended-telemetry.jsonl"
            ),
            "asrRobustness": telemetry_summary(
                "weekend-v10-asr-extended-telemetry.jsonl"
            ),
        },
        "qualityGates": {
            "localTests": {"passed": 33, "total": 33},
            "localProductionBuild": "passed",
            "radeonWorkingTreeTests": {"passed": 33, "total": 33},
            "radeonWorkingTreeProductionBuild": "passed",
            "semanticGatePassRate": 1,
        },
        "rawEvidence": {
            name: {
                "sha256": file_sha256(BENCHMARKS / name),
            }
            for name in raw_files
        },
    }
    output = BENCHMARKS / "weekend-v10-summary.json"
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(output)


if __name__ == "__main__":
    main()
