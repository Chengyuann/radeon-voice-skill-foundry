# Track 2 Rules and Readiness Audit

Audited: 2026-07-21 (UTC+8)

Sources checked:

- AMD AI DevMaster Hackathon Luma page
- Official Rules and Conditions Google Doc, text export
- `AMD-DEV-CONTEST/Radeon-hackathon-2026-07` README at upstream commit
  `88d4bf6`

## Governing Track 2 Requirements

The detailed Rules and Conditions define Track 2 as development and local
deployment of a private AI Agent on Radeon Cloud and ROCm. Core inference must
run on the Radeon GPU; remote APIs cannot provide core functions.

The project must demonstrate:

1. local deployment on AMD Radeon GPU
2. scenario-based task execution
3. tool invocation and workflow orchestration
4. stable local operation and response performance

At least two of these five capabilities are required:

- local knowledge retrieval
- tool invocation
- multi-step planning
- local multi-turn memory
- permission control and privacy protection

Radeon Voice Skill Foundry implements all five.

## Official Scoring Structure

The detailed governing document defines 120 possible points:

| Criterion | Points |
|---|---:|
| Clear task positioning and creative scenario | 20 |
| Task decomposition, tools, RAG, and memory | 20 |
| Smooth multi-turn interaction | 20 |
| Core inference on Radeon and ROCm | 20 |
| Targeted inference-speed optimization | 20 |
| Optional quantization, distillation, or other optimization bonus | 20 |

The public Luma overview summarizes the base evaluation as 60 functional points
plus 40 Radeon/ROCm points. The extra 20 points appear only in the detailed
Rules and Conditions. Submission materials therefore separate the base
100-point evidence from optional-bonus evidence.

## Required Deliverables

| Deliverable | Status | Evidence |
|---|---|---|
| English Project Specification | Complete | Markdown and PDF |
| Agent architecture diagram | Complete | `submission/ARCHITECTURE.png` |
| Core capabilities and deployment plan | Complete | Project Specification sections 4-6 |
| Radeon inference optimization | Complete | Project Specification sections 7-8 and raw JSON/JSONL |
| Complete source repository | Complete | Public MIT repository |
| README with environment, startup, and dependencies | Complete | Root `README.md` |
| 3-5 minute real-operation Demo | Complete | Demo V3, 4:49 |
| Poster or PPT | Complete | Poster PDF and PNG |
| English official pull request | Complete | PR #7, open and mergeable |

## Compliance Assessment

| Requirement | Verdict | Notes |
|---|---|---|
| Core inference on Radeon Cloud and ROCm | Pass | Qwen3-ASR and Qwen3-4B run on W7900-class `gfx1100`, ROCm 7.2.1 |
| No closed API for core functions | Pass | TTS and image generation are used only for presentation assets |
| Scenario task execution | Pass | Six server-accepted actions form the teaching contract |
| Tool invocation and orchestration | Pass | Typed file, report, mail, calendar, and network capability model |
| Operational stability | Pass | Durable runs, proof compatibility, restart recovery, and tunnel recovery |
| Minimum Agent capabilities | Pass | All five listed categories implemented |
| Actual-operation Demo | Pass | Real public workflow and real model wait retained |
| Source reproducibility | Pass with environment caveat | Deterministic fallback runs locally; measured Radeon path requires equivalent ROCm hardware |
| Content restrictions | Pass | No sexual, violent, discriminatory, political, illegal, or defamatory content |

## Claim Boundaries

- Local knowledge retrieval is deterministic token-overlap retrieval over
  local JSON documents. It is not described as embedding or vector search.
- The Voice Evidence result is an internal signal-quality gate, not word-error
  rate or an external speech benchmark.
- Exact promoted-skill reuse avoids an identical repeat model call. It is an
  application fast path, not a fresh-inference GPU speedup.
- The governance ledger is hash-chained and cross-checked against skill
  memory. It has no external signature or immutable third-party anchor.
- Quark INT8 is a rejected acceptance experiment. Production remains FP16.
- The public demo uses Cloudflare as a UI and authenticated transport layer;
  core inference and source audio processing remain on the dedicated Radeon
  instance.

## Remaining External Risk

The public product depends on the live Radeon Cloud instance and a Quick
Tunnel. KV-backed origin recovery has been tested, but a named Cloudflare
Tunnel would be preferable for a long-lived production deployment. The current
setup is retained through judging so the public Demo remains available.
