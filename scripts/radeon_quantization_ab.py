#!/usr/bin/env python3
"""Benchmark one OpenAI-compatible model endpoint for the W7900 quantization A/B."""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path

from radeon_weekend_experiments import (
    TelemetrySampler,
    environment_snapshot,
    run_inference_matrix,
)


def command_output(command: list[str]) -> str:
    return subprocess.run(
        command,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    ).stdout.strip()


def directory_size_bytes(path: Path | None) -> int | None:
    if path is None or not path.exists():
        return None
    output = command_output(["du", "-sbL", str(path)])
    try:
        return int(output.split()[0])
    except (IndexError, ValueError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-url", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--variant", required=True)
    parser.add_argument("--precision", required=True)
    parser.add_argument("--quantization", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--telemetry", type=Path, required=True)
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--server-args", default="")
    args = parser.parse_args()

    measured_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with TelemetrySampler(args.telemetry):
        inference = run_inference_matrix(args.model_url, args.model)

    report = {
        "schemaVersion": "0.1.0",
        "measuredAt": measured_at,
        "variant": args.variant,
        "model": args.model,
        "precision": args.precision,
        "quantization": args.quantization,
        "modelUrl": args.model_url,
        "modelDirectory": str(args.model_dir) if args.model_dir else None,
        "modelDirectoryBytes": directory_size_bytes(args.model_dir),
        "serverArgs": args.server_args,
        "environment": environment_snapshot(),
        "inference": inference,
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
