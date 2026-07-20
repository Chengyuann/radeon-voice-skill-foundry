# Track 2 Rules and Readiness Audit

Audited: 2026-07-19 (UTC+8)

## Governing Requirements

The official competition repository requires Track 2 submissions to include:

- an English Project Specification covering application scenarios, Agent
  architecture, core capabilities, local deployment, and Radeon inference
  optimization
- complete source code with environment, dependency, and startup instructions
- a 3-5 minute Demo showing the actual workflow and Radeon execution
- either a PPT or poster
- an English pull request to the official repository

The detailed Rules & Conditions export scores the main rubric out of 100:

- Agent functional completeness: 60
  - positioning and creative scenario: 20
  - decomposition, tools, RAG, and memory: 20
  - smooth multi-turn interaction: 20
- Radeon / ROCm: 40
  - core inference on Radeon: 20
  - targeted inference-speed optimization: 20

The detailed English rules also describe a possible 20-point optimization
bonus. The guaranteed readiness claim in this audit remains the 100-point main
rubric.

Track 2 requires at least two of local RAG, tool invocation, multi-step
planning, local memory, and permission/privacy control. This project implements
all five.

## Judge Quick Path

1. Open the live product:
   `https://radeon-voice-skill-foundry.pages.dev/`
2. Watch the recommended 4:48 Demo V2:
   `RADEON_VOICE_SKILL_FOUNDRY_DEMO_V2.mp4`
3. Read `submission/SCORING_EVIDENCE_MATRIX.md`.
4. Review `submission/PROJECT_SPECIFICATION.pdf` and
   `submission/ARCHITECTURE.png`.
5. Inspect `docs/WEEKEND_W7900_EXPERIMENTS.md` and
   `benchmarks/weekend-v10-summary.json` for raw Radeon optimization evidence.
6. Use `CONTINUOUS_OPERATION_DEMO_V2.mp4` only for restart, invalidation, and
   proof-lineage behavior.

## Main Rubric Readiness

| Rubric item | Weight | Status | Primary evidence |
|---|---:|---|---|
| Positioning and creative scenario | 20 | Complete | voice-seeded cold-start verification; Project Specification sections 1-3; Demo V2 00:00-00:32 |
| Decomposition, tools, RAG, and memory | 20 | Complete | all five Track 2 capability categories; Demo V2 Voice -> Policy -> Proof -> Memory |
| Smooth multi-turn interaction | 20 | Complete | module UI, transcript acknowledgement, natural-language revision, save/reuse, revalidation; both V2 demos |
| Core inference on Radeon | 20 | Complete | real Cloudflare -> authenticated gateway -> W7900 Qwen3-ASR and Qwen3-4B path; Demo V2 |
| Targeted inference optimization | 20 | Complete | Transformers/vLLM A/B, native ASR batching, compact output, exact verified-skill reuse |

This table is a readiness mapping, not a claim that judges have awarded a
score.

## Required Deliverables

| Deliverable | Status | Evidence |
|---|---|---|
| Public source repository | Complete | `github.com/Chengyuann/radeon-voice-skill-foundry` |
| English source README | Complete | setup, deployment, verification, benchmark, and Demo instructions |
| English Project Specification | Complete | Markdown and generated PDF |
| Agent architecture diagram | Complete | `submission/ARCHITECTURE.png` |
| 3-5 minute actual-operation Demo | Complete | 4:48 Demo V2 with real W7900 inference |
| Poster | Complete | `submission/POSTER.pdf` and PNG |
| Official English PR | Complete | AMD official repository PR #7, open and mergeable |
| Public interactive surface | Complete | Cloudflare Pages entry point with authenticated W7900 gateway |

## Technical Evidence

- Radeon Pro W7900-class, `gfx1100`, 47.98 GiB VRAM
- ROCm 7.2.1
- Qwen3-ASR-0.6B and Qwen3-4B-Instruct-2507 core inference on Radeon
- Voice Evidence v0.3 clean sample: `pass / 100`
- server-authoritative policy: `mail.send = deny`
- deterministic verification: `7/7`
- current local regression suite: `63/63`, typecheck, production build
- server-authoritative demonstration workspace captures six ordered user
  operations, rejects browser action tampering, and exports
  `action_contract.json`; irreversible email/calendar side effects remain
  simulated
- Sandbox Replay v1 exposes six state transitions, before/after hashes, output
  diffs, five adversarial probes, and zero external side effects
- procedural memory uses an explicit candidate/promoted/superseded/revoked
  lifecycle; reuse requires promotion, revocation requires a reason, and
  rollback creates a newly verified version instead of mutating history
- Promotion Impact Review diffs permissions, constraints, actions, and runtime;
  stale hashes fail closed and risk escalation requires explicit acceptance
- Governance Audit Ledger chains lifecycle receipts, reconciles them with
  skill memory, exposes invalid states, and exports JSONL
- clean W7900 weekend experiment commit: `33/33`, production build
- vLLM graph concurrency-eight throughput: `257.65 tokens/s`
- serialized Transformers concurrency-eight throughput: `20.66 tokens/s`
- measured serving throughput improvement: `12.47x`
- native ASR batch-eight aggregate speed: `85.35x real-time`
- compact structured output: `29.42%` fewer output tokens and `30.03%`
  lower generation latency
- exact Verified Skill reuse: `2.18 ms` median HTTP, measured `11,052x`
  identical-skill fast path
- Quark quantization evaluation completed on W7900:
  - INT4 W4A16 export reduced model storage by `66.73%`, but the installed
    vLLM Quark loader rejected that serving scheme
  - INT8 W8A8 reduced model-load VRAM by `44.07%` and increased KV-cache
    capacity by `88.43%`
  - INT8 C128 was `36.70%` slower at concurrency eight and passed only `11/51`
    complete safety-semantic gates, so it was rejected for production
- Adaptive Precision Controller v12:
  - JSON Schema improved INT8 strict JSON from `0/12` to `2/12`
  - semantic admission remained `0/12`
  - automatic FP16 fallback restored `12/12` accepted outputs
  - a real voice-backed proof recorded fallback, `mail.send = deny`, and `7/7`

## Evidence Boundaries

The two V2 videos have intentionally different evidence roles:

- **Main Demo V2** is the performance and product proof. It records the public
  Cloudflare product executing real Qwen3-ASR and Qwen3-4B inference on the
  W7900. The real model generation wait is preserved.
- **Continuous Lifecycle Demo V2** is deterministic control evidence. It uses
  repository ASR/compiler fixtures so two real Node API restarts, runtime
  drift, invalidation, and child-proof revalidation can be reproduced in one
  take. It is not presented as GPU performance evidence.

The synthetic Chinese SOP WAV is a reproducible fixture, not a claimed human
recording. Acoustic drift in the weekend study is relative to the deterministic
clean ASR output, not a human gold transcript.

## Residual Risk and Bonus Work

The main 100-point rubric has direct evidence. The stable Cloudflare Pages URL
still uses a W7900 Quick Tunnel, but the current origin is dynamically
registered in Cloudflare KV. A Supervisor-managed registrar accepts only HTTPS
`trycloudflare.com` origins, validates the public candidate with the API token,
and sends a fresh HMAC-signed Radeon health proof. Pages verifies the second
recovery token, API-token signature, timestamp, and runtime fields before
writing KV. A tunnel restart therefore recovers without a Pages redeploy. A
named Tunnel remains the preferred post-contest upgrade because it removes the
rotating hostname entirely.

The Quark INT4/INT8 A/B is complete. It produced a capacity benefit but no
acceptable speed/quality replacement for FP16. This negative result strengthens
the current deployment decision rather than adding a quantized production
claim. FP8 remains untested because loader registration alone does not prove a
native accelerated FP8 path on RDNA3 `gfx1100`.
