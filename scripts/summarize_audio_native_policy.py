#!/usr/bin/env python3
"""Summarize Qwen2.5-Omni raw-audio policy experiments."""

from __future__ import annotations

import argparse
import hashlib
import json
import statistics
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--strict", type=Path, required=True)
    parser.add_argument("--noise", type=Path, required=True)
    parser.add_argument("--alert", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    paths = {
        "baseline": args.baseline,
        "strict": args.strict,
        "noise": args.noise,
        "alert": args.alert,
    }
    reports = {
        name: json.loads(path.read_text(encoding="utf-8"))
        for name, path in paths.items()
    }
    rows = []
    for name, report in reports.items():
        assessment = report["assessment"]
        rows.append(
            {
                "variant": name,
                "strictTaxonomyPrompt": report.get(
                    "strictTaxonomyPrompt", False
                ),
                "inputSha256": report["audio"]["sha256"],
                "loadSeconds": report["loadSeconds"],
                "inferenceSeconds": report["inferenceSeconds"],
                "peakVramGiB": report["peakVramGiB"],
                "constraintCount": assessment["constraintCount"],
                "kinds": assessment["kinds"],
                "missingKinds": assessment["missingKinds"],
                "semantics": assessment["semantics"],
                "missingSemantics": assessment["missingSemantics"],
                "audioObservationCount": assessment[
                    "audioObservationCount"
                ],
                "admitted": assessment["admitted"],
                "rawReportSha256": sha256(paths[name]),
                "rawOutputSha256": report["rawOutputSha256"],
            }
        )

    strict_rows = [row for row in rows if row["strictTaxonomyPrompt"]]
    output = {
        "schemaVersion": "0.1.0",
        "title": "Audio-Native Policy Critic on Radeon W7900",
        "candidateRole": "non-production independent raw-audio policy critic",
        "productionPath": (
            "Qwen3-ASR-0.6B -> Qwen3-4B-Instruct-2507 remains authoritative"
        ),
        "model": reports["strict"]["model"],
        "modelRevision": reports["strict"]["modelRevision"],
        "precision": reports["strict"]["precision"],
        "attention": reports["strict"]["attention"],
        "talkerDisabled": True,
        "licenseBoundary": reports["strict"]["licenseBoundary"],
        "runtime": reports["strict"]["runtime"],
        "variants": rows,
        "summary": {
            "baselineSemanticGatePassed": not rows[0]["missingSemantics"],
            "baselineTaxonomyGatePassed": not rows[0]["missingKinds"],
            "baselineAdmitted": rows[0]["admitted"],
            "strictVariantCount": len(strict_rows),
            "strictAdmittedCount": sum(
                row["admitted"] for row in strict_rows
            ),
            "strictAdmittedRate": round(
                sum(row["admitted"] for row in strict_rows)
                / max(len(strict_rows), 1),
                4,
            ),
            "strictMedianInferenceSeconds": round(
                statistics.median(
                    row["inferenceSeconds"] for row in strict_rows
                ),
                3,
            ),
            "strictMaxPeakVramGiB": round(
                max(row["peakVramGiB"] for row in strict_rows),
                3,
            ),
            "noiseSafetyKindsPreserved": reports["noise"]["assessment"][
                "admitted"
            ],
            "alertSafetyKindsPreserved": reports["alert"]["assessment"][
                "admitted"
            ],
            "alertAudioObservationCount": reports["alert"]["assessment"][
                "audioObservationCount"
            ],
            "alertPolicyKindsUnchanged": (
                reports["alert"]["assessment"]["kinds"]
                == reports["strict"]["assessment"]["kinds"]
            ),
        },
        "decision": {
            "status": "research-candidate-only",
            "reason": (
                "The raw-audio model recovered all required safety semantics "
                "and passed 3/3 strict taxonomy variants, including noise and "
                "alert-tone inputs. The unconstrained prompt misclassified "
                "two enforcement kinds, so fail-closed taxonomy guidance or "
                "cross-verification remains mandatory. The model license is "
                "non-commercial research/evaluation only."
            ),
            "nextArchitecture": (
                "Use the audio-native model as an independent Policy Critic "
                "that cross-checks the production ASR-plus-Agent pipeline; "
                "never let it directly grant permissions."
            ),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
