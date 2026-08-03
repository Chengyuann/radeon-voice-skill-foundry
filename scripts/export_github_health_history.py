#!/usr/bin/env python3
"""Export successful scheduled GitHub public-health runs as evidence."""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--repo",
        default="Chengyuann/radeon-voice-skill-foundry",
    )
    args = parser.parse_args()

    response = subprocess.run(
        [
            "gh",
            "api",
            (
                f"repos/{args.repo}/actions/workflows/"
                "radeon-health.yml/runs?event=schedule&per_page=100"
            ),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(response.stdout)
    runs = sorted(
        payload.get("workflow_runs", []),
        key=lambda item: item["created_at"],
    )
    if not runs:
        raise SystemExit("No scheduled health runs found")

    first = parse_time(runs[0]["created_at"])
    last = parse_time(runs[-1]["created_at"])
    records = [
        {
            "runId": item["id"],
            "createdAt": item["created_at"],
            "conclusion": item["conclusion"],
            "headSha": item["head_sha"],
            "url": item["html_url"],
        }
        for item in runs
    ]
    successes = sum(item["conclusion"] == "success" for item in runs)
    summary = {
        "schemaVersion": "0.1.0",
        "capturedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "workflow": "Radeon Public Health",
        "scheduleRequest": "7,22,37,52 * * * *",
        "schedulerBoundary": (
            "GitHub Actions schedule execution is best-effort and may be "
            "delayed or coalesced; observed runs are reported, not an exact "
            "15-minute execution claim."
        ),
        "firstRunAt": runs[0]["created_at"],
        "lastRunAt": runs[-1]["created_at"],
        "observedDurationHours": round(
            (last - first).total_seconds() / 3600, 2
        ),
        "runCount": len(runs),
        "successCount": successes,
        "failureCount": len(runs) - successes,
        "latestRun": records[-1],
        "runs": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
