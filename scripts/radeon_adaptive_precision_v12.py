#!/usr/bin/env python3
"""Evaluate schema-constrained INT8 and adaptive FP16 fallback on W7900."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path
from urllib import error, request


MODEL = "Qwen/Qwen3-4B-Instruct-2507"
KINDS = [
    "must",
    "must_not",
    "only_if",
    "unless",
    "redact",
    "requires_confirmation",
]
REQUIRED_KINDS = {
    "must_not",
    "only_if",
    "redact",
    "requires_confirmation",
}
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["constraints"],
    "properties": {
        "constraints": {
            "type": "array",
            "minItems": 1,
            "maxItems": 20,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "kind",
                    "statement",
                    "sourceText",
                    "appliesTo",
                ],
                "properties": {
                    "kind": {"type": "string", "enum": KINDS},
                    "statement": {"type": "string", "minLength": 1},
                    "sourceText": {"type": "string", "minLength": 1},
                    "appliesTo": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
            },
        }
    },
}
SYSTEM = (
    "Extract enforceable SOP constraints. Return atomic rules only. "
    "Sensitive exclusion is redact. Prohibited side effects are must_not. "
    "Missing ownership requires_confirmation. Due-date-only execution is "
    "only_if. Do not invent rules."
)
RULE = (
    "Only retain P0 and P1 findings. Redact compensation data. Draft email "
    "but never send automatically. Missing owner requires confirmation. "
    "Create a calendar hold only when a due date exists."
)


def request_completion(
    base_url: str,
    variation: int,
    structured: bool,
) -> dict:
    payload = {
        "model": MODEL,
        "temperature": 0,
        "max_tokens": 320,
        "chat_template_kwargs": {"enable_thinking": False},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": f"Scenario variation {variation}: {RULE}",
            },
        ],
        "response_format": (
            {
                "type": "json_schema",
                "json_schema": {
                    "name": "sop_constraints",
                    "strict": True,
                    "schema": SCHEMA,
                },
            }
            if structured
            else {"type": "json_object"}
        ),
    }
    req = request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        with request.urlopen(req, timeout=180) as response:
            body = json.loads(response.read().decode())
        status = response.status
    except error.HTTPError as exc:
        return {
            "ok": False,
            "status": exc.code,
            "latencyMs": round((time.perf_counter() - started) * 1000, 2),
            "error": exc.read().decode(errors="replace")[:2000],
        }
    content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
    assessment = assess(content)
    return {
        "ok": True,
        "status": status,
        "latencyMs": round((time.perf_counter() - started) * 1000, 2),
        "usage": body.get("usage"),
        "contentSha256": hashlib.sha256(content.encode()).hexdigest(),
        "content": content,
        **assessment,
    }


def assess(content: str) -> dict:
    try:
        parsed = json.loads(content)
        constraints = parsed.get("constraints")
        valid = isinstance(constraints, list) and bool(constraints)
    except (json.JSONDecodeError, AttributeError):
        constraints = []
        valid = False
    if not isinstance(constraints, list):
        constraints = []
    kinds = {
        item.get("kind")
        for item in constraints
        if isinstance(item, dict)
    }
    missing = sorted(REQUIRED_KINDS - kinds)
    return {
        "jsonValid": valid,
        "kinds": sorted(kind for kind in kinds if isinstance(kind, str)),
        "missingKinds": missing,
        "admitted": valid and not missing,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode", choices=["primary", "adaptive"], required=True
    )
    parser.add_argument("--int8-url")
    parser.add_argument("--fp16-url")
    parser.add_argument("--primary-report", type=Path)
    parser.add_argument("--runs", type=int, default=12)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if args.mode == "adaptive":
        if not args.primary_report or not args.fp16_url:
            parser.error("adaptive mode requires --primary-report and --fp16-url")
        primary_report = json.loads(
            args.primary_report.read_text(encoding="utf-8")
        )
        constrained_int8 = primary_report["schemaConstrainedInt8"]
        adaptive = []
        for index, primary in enumerate(constrained_int8):
            if primary.get("admitted"):
                adaptive.append(
                    {
                        "variation": index,
                        "selected": "int8",
                        "latencyMs": primary["latencyMs"],
                        "primary": primary,
                    }
                )
                continue
            fallback = request_completion(
                args.fp16_url, 2000 + index, True
            )
            adaptive.append(
                {
                    "variation": index,
                    "selected": "fp16",
                    "latencyMs": round(
                        primary["latencyMs"] + fallback["latencyMs"], 2
                    ),
                    "primary": primary,
                    "fallback": fallback,
                }
            )
        report = {
            **primary_report,
            "adaptive": adaptive,
            "summary": {
                **primary_report["summary"],
                "fallbackCount": sum(
                    row["selected"] == "fp16" for row in adaptive
                ),
                "adaptiveAccepted": sum(
                    (
                        row["primary"].get("admitted", False)
                        if row["selected"] == "int8"
                        else row["fallback"].get("admitted", False)
                    )
                    for row in adaptive
                ),
                "medianAdaptiveLatencyMs": median(
                    row["latencyMs"] for row in adaptive
                ),
                "medianFallbackOnlyLatencyMs": median(
                    [
                        row["fallback"]["latencyMs"]
                        for row in adaptive
                        if row["selected"] == "fp16"
                    ]
                ),
            },
        }
        write_report(args.output, report)
        return 0

    if not args.int8_url:
        parser.error("primary mode requires --int8-url")
    raw_int8 = []
    constrained_int8 = []
    for index in range(args.runs):
        raw_int8.append(
            request_completion(args.int8_url, 1000 + index, False)
        )
        primary = request_completion(
            args.int8_url, 2000 + index, True
        )
        constrained_int8.append(primary)

    report = {
        "schemaVersion": "0.1.0",
        "measuredAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": MODEL,
        "runs": args.runs,
        "rawInt8": raw_int8,
        "schemaConstrainedInt8": constrained_int8,
        "summary": {
            "rawInt8JsonValid": sum(
                row.get("jsonValid", False) for row in raw_int8
            ),
            "rawInt8Admitted": sum(
                row.get("admitted", False) for row in raw_int8
            ),
            "constrainedInt8JsonValid": sum(
                row.get("jsonValid", False) for row in constrained_int8
            ),
            "constrainedInt8Admitted": sum(
                row.get("admitted", False) for row in constrained_int8
            ),
            "medianRawInt8LatencyMs": median(
                row["latencyMs"] for row in raw_int8
            ),
            "medianConstrainedInt8LatencyMs": median(
                row["latencyMs"] for row in constrained_int8
            ),
        },
    }
    write_report(args.output, report)
    return 0


def median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return round((ordered[middle - 1] + ordered[middle]) / 2, 2)


def write_report(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(path)


if __name__ == "__main__":
    raise SystemExit(main())
