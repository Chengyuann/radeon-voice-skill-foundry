#!/usr/bin/env python3
"""Minimal OpenAI-compatible local model server for Radeon Cloud."""

from __future__ import annotations

import json
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer


MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen3-4B-Instruct-2507")
HOST = os.getenv("MODEL_HOST", "0.0.0.0")
PORT = int(os.getenv("MODEL_PORT", "8000"))
DTYPE = torch.bfloat16 if os.getenv("MODEL_DTYPE", "float16") == "bfloat16" else torch.float16

print(f"Loading {MODEL_ID} on Radeon GPU...", flush=True)
LOAD_STARTED = time.perf_counter()
TOKENIZER = AutoTokenizer.from_pretrained(MODEL_ID)
MODEL = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    dtype=DTYPE,
    device_map="cuda",
)
MODEL.eval()
LOAD_SECONDS = time.perf_counter() - LOAD_STARTED
GENERATION_LOCK = threading.Lock()
print(
    json.dumps(
        {
            "event": "model_loaded",
            "model": MODEL_ID,
            "loadSeconds": round(LOAD_SECONDS, 3),
            "device": torch.cuda.get_device_name(0),
            "vramGiB": round(
                torch.cuda.get_device_properties(0).total_memory / 1024**3, 2
            ),
        }
    ),
    flush=True,
)


class Handler(BaseHTTPRequestHandler):
    server_version = "RadeonModelServer/0.1"

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            self._json(
                200,
                {
                    "ok": True,
                    "model": MODEL_ID,
                    "device": torch.cuda.get_device_name(0),
                    "hip": torch.version.hip,
                    "loadSeconds": round(LOAD_SECONDS, 3),
                },
            )
            return
        if self.path.rstrip("/") == "/v1/models":
            self._json(
                200,
                {
                    "object": "list",
                    "data": [{"id": MODEL_ID, "object": "model"}],
                },
            )
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/v1/chat/completions":
            self._json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("content-length", "0"))
            request = json.loads(self.rfile.read(length))
            messages = request.get("messages", [])
            max_tokens = min(int(request.get("max_tokens", 512)), 1024)
            text = TOKENIZER.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
                enable_thinking=False,
            )
            inputs = TOKENIZER(text, return_tensors="pt").to("cuda")
            streamer = TextIteratorStreamer(
                TOKENIZER,
                skip_prompt=True,
                skip_special_tokens=True,
            )
            kwargs = {
                **inputs,
                "max_new_tokens": max_tokens,
                "do_sample": False,
                "streamer": streamer,
                "pad_token_id": TOKENIZER.eos_token_id,
            }

            with GENERATION_LOCK:
                torch.cuda.reset_peak_memory_stats()
                torch.cuda.synchronize()
                started = time.perf_counter()
                first_token_at = None
                parts: list[str] = []
                thread = threading.Thread(target=MODEL.generate, kwargs=kwargs)
                thread.start()
                for part in streamer:
                    if first_token_at is None:
                        torch.cuda.synchronize()
                        first_token_at = time.perf_counter()
                    parts.append(part)
                thread.join()
                torch.cuda.synchronize()
                ended = time.perf_counter()

            content = "".join(parts).strip()
            output_tokens = len(
                TOKENIZER(content, add_special_tokens=False).input_ids
            )
            input_tokens = int(inputs.input_ids.shape[-1])
            generation_seconds = max(ended - started, 1e-9)
            metrics = {
                "ttftMs": round(
                    ((first_token_at or ended) - started) * 1000, 2
                ),
                "generationMs": round(generation_seconds * 1000, 2),
                "tokensPerSecond": round(output_tokens / generation_seconds, 2),
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "peakVramGiB": round(
                    torch.cuda.max_memory_allocated() / 1024**3, 3
                ),
            }
            self._json(
                200,
                {
                    "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": MODEL_ID,
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": content,
                            },
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {
                        "prompt_tokens": input_tokens,
                        "completion_tokens": output_tokens,
                        "total_tokens": input_tokens + output_tokens,
                    },
                    "metrics": metrics,
                },
            )
        except Exception as exc:  # noqa: BLE001
            self._json(
                500,
                {
                    "error": {
                        "type": type(exc).__name__,
                        "message": str(exc),
                    }
                },
            )

    def log_message(self, fmt: str, *args: object) -> None:
        print(
            json.dumps(
                {
                    "event": "http",
                    "client": self.client_address[0],
                    "message": fmt % args,
                }
            ),
            flush=True,
        )

    def _json(self, status: int, payload: object) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print(f"Listening on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
