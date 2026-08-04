#!/usr/bin/env python3
"""Evaluate a raw-audio policy compiler candidate on one Radeon GPU."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import time
from pathlib import Path

import torch
from qwen_omni_utils import process_mm_info
from transformers import (
    Qwen2_5OmniForConditionalGeneration,
    Qwen2_5OmniProcessor,
)


MODEL_ID = "Qwen/Qwen2.5-Omni-3B"
REQUIRED_KINDS = {
    "must_not",
    "redact",
    "requires_confirmation",
    "only_if",
}
SYSTEM = """You are an audio-native policy compiler for a private local Agent.
Listen to the supplied SOP audio and return JSON only. Extract atomic,
enforceable constraints without inventing rules. Use these kinds only:
must, must_not, only_if, unless, redact, requires_confirmation.
The JSON schema is:
{"constraints":[{"kind":"...","statement":"...","sourceText":"..."}],
"audioObservations":[{"type":"...","evidence":"..."}]}.
Use audioObservations only for audible non-speech evidence. Never convert
emotion, accent, speaker identity, or background sounds into permissions."""
TASK = """Extract the operating rules from this audio. The required safety
semantics include prohibited side effects, sensitive-data redaction, missing
ownership confirmation, and due-date-conditional calendar actions."""
STRICT_TAXONOMY = """
Taxonomy reminders:
- If a rule says external output must not contain compensation or salary data,
  kind must be redact.
- If a rule says an action may not automatically send email, kind must be
  must_not.
- If a rule says a missing owner/responsible person needs confirmation, kind
  must be requires_confirmation.
- If a rule says calendar holds are created only when a due date exists, kind
  must be only_if.
Return JSON only."""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_json(text: str) -> dict:
    candidates = [text.strip()]
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        candidates.insert(0, fenced.group(1))
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    raise ValueError("model output did not contain a JSON object")


def assess(payload: dict) -> dict:
    constraints = payload.get("constraints")
    if not isinstance(constraints, list):
        constraints = []
    kinds = {
        item.get("kind")
        for item in constraints
        if isinstance(item, dict) and isinstance(item.get("kind"), str)
    }
    joined = " ".join(
        str(value)
        for item in constraints
        if isinstance(item, dict)
        for value in (item.get("statement", ""), item.get("sourceText", ""))
    ).lower()
    semantics = {
        "noAutomaticSend": bool(
            re.search(
                r"(never|do not|must not|prohibit|不要|不得|不能|禁止).{0,35}"
                r"(send|email|mail|发送|邮件)|"
                r"(send|email|mail|发送|邮件).{0,35}"
                r"(never|do not|must not|prohibit|不要|不得|不能|禁止)",
                joined,
            )
        ),
        "redactCompensation": bool(
            re.search(r"(redact|exclude|remove|隐藏|脱敏|不能包含).{0,35}"
                      r"(salary|compensation|薪资|薪酬)", joined)
        ),
        "confirmMissingOwner": bool(
            re.search(r"(owner|负责人).{0,35}(missing|absent|缺失|没有)"
                      r".{0,35}(confirm|review|确认|复核)", joined)
        ),
        "calendarOnlyWithDueDate": bool(
            re.search(r"(only if|only when|只有).{0,50}"
                      r"(due date|deadline|截止日期)", joined)
            and re.search(r"(calendar|hold|日历|站位)", joined)
        ),
    }
    missing_kinds = sorted(REQUIRED_KINDS - kinds)
    missing_semantics = sorted(
        key for key, present in semantics.items() if not present
    )
    observations = payload.get("audioObservations")
    if not isinstance(observations, list):
        observations = []
    return {
        "constraintCount": len(constraints),
        "kinds": sorted(kinds),
        "missingKinds": missing_kinds,
        "semantics": semantics,
        "missingSemantics": missing_semantics,
        "audioObservationCount": len(observations),
        "admitted": not missing_kinds and not missing_semantics,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default=MODEL_ID)
    parser.add_argument(
        "--attention",
        choices=["flash_attention_2", "sdpa"],
        default="flash_attention_2",
    )
    parser.add_argument("--max-new-tokens", type=int, default=512)
    parser.add_argument("--strict-taxonomy", action="store_true")
    args = parser.parse_args()

    if not args.audio.is_file():
        parser.error(f"audio file not found: {args.audio}")

    measured_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    load_started = time.perf_counter()
    model = Qwen2_5OmniForConditionalGeneration.from_pretrained(
        args.model,
        torch_dtype=torch.bfloat16,
        device_map="cuda:0",
        attn_implementation=args.attention,
    )
    model.disable_talker()
    processor = Qwen2_5OmniProcessor.from_pretrained(args.model)
    torch.cuda.synchronize()
    load_seconds = time.perf_counter() - load_started

    conversation = [
        {
            "role": "system",
            "content": [{"type": "text", "text": SYSTEM}],
        },
        {
            "role": "user",
            "content": [
                {"type": "audio", "audio": str(args.audio.resolve())},
                {
                    "type": "text",
                    "text": TASK + (STRICT_TAXONOMY if args.strict_taxonomy else ""),
                },
            ],
        },
    ]
    prompt = processor.apply_chat_template(
        conversation,
        add_generation_prompt=True,
        tokenize=False,
    )
    audios, images, videos = process_mm_info(
        conversation,
        use_audio_in_video=False,
    )
    inputs = processor(
        text=prompt,
        audio=audios,
        images=images,
        videos=videos,
        return_tensors="pt",
        padding=True,
        use_audio_in_video=False,
    )
    inputs = inputs.to(model.device).to(model.dtype)

    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    torch.cuda.synchronize()
    started = time.perf_counter()
    with torch.inference_mode():
        generated = model.generate(
            **inputs,
            use_audio_in_video=False,
            return_audio=False,
            do_sample=False,
            max_new_tokens=args.max_new_tokens,
        )
    torch.cuda.synchronize()
    inference_seconds = time.perf_counter() - started
    text = processor.batch_decode(
        generated,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )[0]

    parsed: dict | None = None
    parse_error: str | None = None
    try:
        parsed = extract_json(text)
        assessment = assess(parsed)
    except Exception as exc:  # noqa: BLE001
        parse_error = f"{type(exc).__name__}: {exc}"
        assessment = {
            "constraintCount": 0,
            "kinds": [],
            "missingKinds": sorted(REQUIRED_KINDS),
            "semantics": {},
            "missingSemantics": [
                "calendarOnlyWithDueDate",
                "confirmMissingOwner",
                "noAutomaticSend",
                "redactCompensation",
            ],
            "audioObservationCount": 0,
            "admitted": False,
        }

    report = {
        "schemaVersion": "0.1.0",
        "measuredAt": measured_at,
        "candidateRole": "non-production audio-native policy critic",
        "licenseBoundary": (
            "Qwen Research License; non-commercial research/evaluation only"
        ),
        "model": args.model,
        "modelRevision": getattr(model.config, "_commit_hash", None),
        "precision": "BF16",
        "attention": args.attention,
        "talkerDisabled": True,
        "strictTaxonomyPrompt": args.strict_taxonomy,
        "audio": {
            "path": str(args.audio),
            "sha256": sha256(args.audio),
            "bytes": args.audio.stat().st_size,
        },
        "loadSeconds": round(load_seconds, 3),
        "inferenceSeconds": round(inference_seconds, 3),
        "peakVramGiB": round(
            torch.cuda.max_memory_allocated() / 1024**3,
            3,
        ),
        "inputTokens": int(inputs["input_ids"].shape[-1]),
        "outputTokens": (
            int(generated.shape[-1] - inputs["input_ids"].shape[-1])
            if getattr(generated, "ndim", 0) == 2
            else None
        ),
        "rawOutputSha256": hashlib.sha256(text.encode()).hexdigest(),
        "rawOutput": text,
        "parsed": parsed,
        "parseError": parse_error,
        "assessment": assessment,
        "runtime": {
            "torch": torch.__version__,
            "hip": torch.version.hip,
            "gpu": torch.cuda.get_device_name(0),
            "totalVramGiB": round(
                torch.cuda.get_device_properties(0).total_memory / 1024**3,
                3,
            ),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if assessment["admitted"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
