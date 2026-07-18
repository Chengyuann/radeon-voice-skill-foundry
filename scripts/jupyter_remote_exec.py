#!/usr/bin/env python3
"""Execute code or upload files through an authenticated Jupyter Server."""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlencode, urlparse, urlunparse

import requests
import websockets


def api_url(base_url: str, path: str, token: str) -> str:
    separator = "&" if "?" in path else "?"
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}{separator}{urlencode({'token': token})}"


def websocket_url(base_url: str, path: str, token: str) -> str:
    parsed = urlparse(api_url(base_url, path, token))
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return urlunparse(parsed._replace(scheme=scheme))


def request_json(
    method: str,
    base_url: str,
    path: str,
    token: str,
    **kwargs: object,
) -> dict:
    response = requests.request(
        method,
        api_url(base_url, path, token),
        timeout=60,
        **kwargs,
    )
    response.raise_for_status()
    return response.json()


async def execute(
    base_url: str,
    token: str,
    code: str,
    timeout_seconds: float,
) -> int:
    kernel = request_json(
        "POST",
        base_url,
        "api/kernels",
        token,
        json={"name": "python3"},
    )
    kernel_id = kernel["id"]
    session_id = uuid.uuid4().hex
    message_id = uuid.uuid4().hex
    message = {
        "header": {
            "msg_id": message_id,
            "username": "codex",
            "session": session_id,
            "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "msg_type": "execute_request",
            "version": "5.3",
        },
        "parent_header": {},
        "metadata": {},
        "content": {
            "code": code,
            "silent": False,
            "store_history": False,
            "user_expressions": {},
            "allow_stdin": False,
            "stop_on_error": True,
        },
        "channel": "shell",
        "buffers": [],
    }
    deadline = time.monotonic() + timeout_seconds
    status = 0
    try:
        async with websockets.connect(
            websocket_url(
                base_url,
                f"api/kernels/{kernel_id}/channels",
                token,
            ),
            open_timeout=30,
            max_size=64 * 1024 * 1024,
        ) as websocket:
            await websocket.send(json.dumps(message))
            while time.monotonic() < deadline:
                remaining = max(0.1, deadline - time.monotonic())
                raw = await asyncio.wait_for(websocket.recv(), timeout=remaining)
                payload = json.loads(raw)
                parent_id = payload.get("parent_header", {}).get("msg_id")
                if parent_id != message_id:
                    continue
                msg_type = payload.get("msg_type") or payload.get("header", {}).get(
                    "msg_type"
                )
                content = payload.get("content", {})
                if msg_type == "stream":
                    print(content.get("text", ""), end="", flush=True)
                elif msg_type in {"execute_result", "display_data"}:
                    data = content.get("data", {})
                    if "text/plain" in data:
                        print(data["text/plain"])
                elif msg_type == "error":
                    status = 1
                    traceback = content.get("traceback") or []
                    print("\n".join(traceback), file=sys.stderr)
                elif msg_type == "status" and content.get("execution_state") == "idle":
                    return status
        raise TimeoutError(f"Remote execution exceeded {timeout_seconds:.1f}s")
    finally:
        requests.delete(
            api_url(base_url, f"api/kernels/{kernel_id}", token),
            timeout=30,
        )


def upload(base_url: str, token: str, local: Path, remote: str) -> None:
    raw = local.read_bytes()
    try:
        content = raw.decode("utf-8")
        file_format = "text"
    except UnicodeDecodeError:
        content = base64.b64encode(raw).decode("ascii")
        file_format = "base64"
    payload = {"type": "file", "format": file_format, "content": content}
    response = requests.put(
        api_url(base_url, f"api/contents/{remote}", token),
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    print(remote)


def download(base_url: str, token: str, remote: str, local: Path) -> None:
    response = requests.get(
        api_url(base_url, f"files/{remote}", token),
        timeout=120,
    )
    response.raise_for_status()
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_bytes(response.content)
    print(local)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--token", default=os.environ.get("JUPYTER_TOKEN"))
    subparsers = parser.add_subparsers(dest="command", required=True)

    execute_parser = subparsers.add_parser("execute")
    source = execute_parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--code")
    source.add_argument("--file", type=Path)
    execute_parser.add_argument("--timeout", type=float, default=600)

    upload_parser = subparsers.add_parser("upload")
    upload_parser.add_argument("local", type=Path)
    upload_parser.add_argument("remote")

    download_parser = subparsers.add_parser("download")
    download_parser.add_argument("remote")
    download_parser.add_argument("local", type=Path)

    args = parser.parse_args()
    if not args.token:
        parser.error("Set --token or JUPYTER_TOKEN")
    if args.command == "upload":
        upload(args.base_url, args.token, args.local, args.remote)
        return 0
    if args.command == "download":
        download(args.base_url, args.token, args.remote, args.local)
        return 0

    code = args.code if args.code is not None else args.file.read_text(encoding="utf-8")
    return asyncio.run(
        execute(args.base_url, args.token, code, args.timeout)
    )


if __name__ == "__main__":
    raise SystemExit(main())
