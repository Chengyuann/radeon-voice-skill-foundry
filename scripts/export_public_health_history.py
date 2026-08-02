#!/usr/bin/env python3
"""Export local public-health monitor logs as submission evidence."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


LINE_RE = re.compile(
    r"^(?P<timestamp>\S+) status=(?P<status>\S+) http=(?P<http>\S+)"
)


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--jsonl", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()

    records = []
    for line in args.log.read_text(encoding="utf-8").splitlines():
        match = LINE_RE.match(line.strip())
        if not match:
            continue
        timestamp = parse_timestamp(match.group("timestamp"))
        records.append(
            {
                "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
                "status": match.group("status"),
                "http": int(match.group("http"))
                if match.group("http").isdigit()
                else match.group("http"),
                "source": "macOS launchd external public monitor",
                "url": "https://radeon-voice-skill-foundry.pages.dev/api/health"
            }
        )

    if not records:
        raise SystemExit("No health records parsed")

    first = parse_timestamp(records[0]["timestamp"])
    last = parse_timestamp(records[-1]["timestamp"])
    healthy = [item for item in records if item["status"] == "healthy"]
    failures = [item for item in records if item["status"] != "healthy"]
    summary = {
        "schemaVersion": "0.1.0",
        "capturedAt": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "source": "macOS launchd external public monitor",
        "url": "https://radeon-voice-skill-foundry.pages.dev/api/health",
        "firstTimestamp": records[0]["timestamp"],
        "lastTimestamp": records[-1]["timestamp"],
        "durationMinutes": round((last - first).total_seconds() / 60, 2),
        "sampleCount": len(records),
        "healthyCount": len(healthy),
        "failureCount": len(failures),
        "latestStatus": records[-1],
        "notes": [
            "Samples are collected outside the Radeon Cloud instance.",
            "The monitor validates HTTP 200 plus model/asr dependency health."
        ]
    }

    args.jsonl.parent.mkdir(parents=True, exist_ok=True)
    args.jsonl.write_text(
      "".join(f"{json.dumps(item, sort_keys=True)}\n" for item in records),
      encoding="utf-8",
    )
    args.summary.write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
