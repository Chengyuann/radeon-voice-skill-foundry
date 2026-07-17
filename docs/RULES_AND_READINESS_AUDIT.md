# Track 2 Rules and Readiness Audit

Audited: 2026-07-17 (UTC+8)

## Authoritative requirements

Track 2 asks for a fully local, customizable AI Agent on AMD Radeon GPU and
ROCm, with scenario execution, tool invocation/workflow orchestration, and
stable local performance.

Core inference must run locally on Radeon. Closed remote APIs cannot implement
the core function.

Minimum capability requirement: at least two of:

- local RAG
- tool invocation
- multi-step planning
- local multi-turn memory
- permission and privacy controls

## Scoring

The current Rules & Conditions export states:

- Agent functional completeness: 60
  - clear positioning and creative scenario: 20
  - decomposition, tools, RAG, and memory: 20
  - smooth multi-turn interaction: 20
- Radeon / ROCm: 40
  - core inference on Radeon: 20
  - targeted inference-speed optimization: 20
- optional optimization bonus: 20 in the detailed English rules export

The Chinese event copy describes the main score as 100 (60 + 40) and does not
show the optional 20-point line. We should treat 60 + 40 as the guaranteed
rubric and pursue quantization/model-API optimization as bonus evidence rather
than depending on it.

## Submission requirements

- English Project Specification
  - application scenario
  - Agent architecture diagram
  - core capabilities
  - model and local deployment plan
  - Radeon inference optimization
- complete source repository
- English README with setup, startup, and dependencies
- 3-5 minute demo video showing real Radeon execution
- PPT or poster
- fork the official repository and open an English pull request
- PR title:
  - `Track 2, N/A, Radeon Voice Skill Foundry`

## Current project coverage

| Requirement | Status | Evidence / Gap |
|---|---|---|
| Registration approved | Complete | User confirmed |
| AMD Developer Program / Cloud credit | Complete | Radeon Cloud access and 5 credits observed |
| Solo entry | Complete | Team name should be `N/A` |
| Radeon + ROCm local inference | Complete | W7900-class, gfx1100, ROCm 7.2.1 |
| Open-source local Agent model | Complete | Qwen3-4B-Instruct-2507 |
| Local voice model | Complete at benchmark level | Qwen3-ASR-0.6B, 17.98x real-time warm |
| Tool invocation | Complete in deterministic workspace | mail/calendar/file/report capability model |
| Multi-step planning | Complete | spoken SOP -> constraints -> skill -> tests -> proof |
| Permission/privacy | Complete | mail.send deny, redaction, review, receipts |
| RAG | Missing | no indexed policy/SOP retrieval in product |
| Persistent multi-turn memory | Partial | generated skills exist, but no user-facing memory/reuse conversation |
| Smooth multi-turn UX | Partial | current UI is compile/verify, not conversational refinement |
| Real audio in product UI | Missing | ASR measured separately but not connected to browser upload/record |
| Targeted speed optimization | Partial | warm/cold and model-size benchmarks exist; no vLLM/quantization comparison |
| Dedicated Radeon Model API | Missing | custom local server works; official vLLM Model API not created |
| English source README | Partial | usable but still describes planned work that is now complete |
| Project Specification PDF | Missing | must be produced |
| Architecture diagram | Missing as final artifact | text architecture exists |
| Demo video | Missing | must show voice input and real Radeon metrics |
| PPT/poster | Missing | choose poster or compact deck |
| Official submission PR | Missing | only open after final package is ready |

## Estimated rubric readiness

Current evidence-based estimate before the next implementation pass:

- positioning / scenario: strong
- core capabilities: medium-high, reduced by missing RAG and memory UX
- multi-turn experience: medium-low
- local Radeon execution: strong
- optimization: medium, because measured but not yet compared against a
  deliberate optimized serving configuration

The highest-value next work is:

1. connect real audio upload/recording to Qwen3-ASR and SOP compilation
2. add a small local policy/SOP RAG store and verified-skill memory
3. add conversational refinement of learned constraints
4. benchmark Transformers versus an optimized path
5. produce English specification, video, and poster

## Platform readiness

Completed:

- email login and credits
- Blank OpenCode Workspace launch
- Jupyter terminal/API operation
- ROCm/PyTorch/Triton installation
- Node build/test on Radeon Cloud
- local 4B Agent service
- local 0.6B ASR benchmark
- proof ZIP generated on Radeon

Not required but currently absent:

- SSH key and SSH-enabled private template
- official dedicated vLLM Model API
- public cloud URL for the web UI

The lack of SSH does not block development because Jupyter is usable. A public
or recorded demo surface is still needed for judging and presentation.
