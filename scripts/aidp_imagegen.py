#!/usr/bin/env python3
"""Generate project artwork through the ByteDance AIDP OpenAI-compatible API."""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import uuid
from pathlib import Path
from urllib import error, request


DEFAULT_BASE_URL = (
    "https://aidp.bytedance.net/api/modelhub/online/v2/crawl/openai"
)
VALID_SIZES = {"1024x1024", "1536x1024", "1024x1536", "auto"}
VALID_QUALITIES = {"low", "medium", "high", "auto"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a bitmap through AIDP gpt-image-2. The access key is "
            "read only from AIDP_IMAGE_AK."
        )
    )
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="gpt-image-2")
    parser.add_argument("--size", choices=sorted(VALID_SIZES), default="auto")
    parser.add_argument(
        "--quality",
        choices=sorted(VALID_QUALITIES),
        default="auto",
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("AIDP_IMAGE_BASE_URL", DEFAULT_BASE_URL),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    access_key = os.environ.get("AIDP_IMAGE_AK")
    if not access_key:
        print("AIDP_IMAGE_AK is required", file=sys.stderr)
        return 2

    endpoint = f"{args.base_url.rstrip('/')}/images/generations"
    payload = json.dumps(
        {
            "model": args.model,
            "prompt": args.prompt,
            "n": 1,
            "size": args.size,
            "quality": args.quality,
        }
    ).encode("utf-8")
    log_id = f"rvsf-imagegen-{uuid.uuid4().hex}"
    call = request.Request(
        endpoint,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-TT-LOGID": log_id,
            "api-key": access_key,
            "Authorization": f"Bearer {access_key}",
        },
    )
    try:
        with request.urlopen(call, timeout=300) as response:
            result = json.load(response)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(
            f"AIDP image generation failed: HTTP {exc.code}; "
            f"log id: {log_id}; response: {detail[:1000]}",
            file=sys.stderr,
        )
        return 1
    except error.URLError as exc:
        print(
            f"AIDP image generation failed; log id: {log_id}; {exc}",
            file=sys.stderr,
        )
        return 1

    try:
        encoded = result["data"][0]["b64_json"]
        image_bytes = base64.b64decode(encoded, validate=True)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        print(
            f"Unexpected AIDP response; log id: {log_id}; {exc}",
            file=sys.stderr,
        )
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(image_bytes)
    print(
        json.dumps(
            {
                "output": str(args.output),
                "bytes": len(image_bytes),
                "model": args.model,
                "size": args.size,
                "quality": args.quality,
                "logId": log_id,
                "usage": result.get("usage"),
            },
            ensure_ascii=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
