# Radeon Voice Skill Foundry

Radeon Voice Skill Foundry is a Track 2 submission for the AMD AI DevMaster
Hackathon. It converts a spoken operating procedure and a six-step workflow
demonstration into a verified, reusable Agent Skill package.

Core speech recognition and Agent inference run on a dedicated Radeon Cloud
W7900-class GPU with ROCm. The application retrieves local policy evidence,
compiles typed constraints and permissions, runs deterministic positive and
adversarial tests, and requires explicit human promotion before reuse.

## Project Materials

- Live product:
  `https://radeon-voice-skill-foundry.pages.dev/`
- Final 4:49 Demo:
  `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/RADEON_VOICE_SKILL_FOUNDRY_DEMO.mp4`
- Demo captions:
  `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/RADEON_VOICE_SKILL_FOUNDRY_DEMO.srt`
- Demo proof:
  `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/PRODUCT_DEMO_PROOF.zip`
- Performance Demo:
  `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/RADEON_VOICE_SKILL_FOUNDRY_PERFORMANCE_DEMO.mp4`
- Continuous Operation Demo:
  `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/CONTINUOUS_OPERATION_DEMO.mp4`
- Submission checksums:
  `https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission/SHA256SUMS.txt`
- Project Specification: `submission/PROJECT_SPECIFICATION.pdf`
- Technical evidence: `submission/TECHNICAL_EVIDENCE_INDEX.md`
- Official submission:
  `https://github.com/AMD-DEV-CONTEST/Radeon-hackathon-2026-07/pull/7`

## What It Does

The reference scenario is follow-up work after a private project review. The
user supplies a spoken SOP and performs six actions:

1. open the review
2. retain P0 and P1 findings
3. mark a missing owner for confirmation
4. create email drafts
5. create tentative calendar holds
6. export a redacted report

The server records these actions in order. Compilation ignores browser-supplied
action replacements when a trusted demonstration session is present.

The generated package contains:

- portable Agent Skill Markdown in `SKILL.md`
- typed SOP constraints
- allow, review, and deny capability decisions
- positive and adversarial fixtures
- deterministic sandbox replay
- hashed governance receipts
- a proof bundle with source, runtime, policy, and artifact hashes
- versioned procedural memory

The demonstration workspace is isolated. It does not send email, commit
calendar invitations, or perform external network writes.

## Track 2 Capabilities

- **Local knowledge retrieval:** deterministic token-overlap retrieval over
  policy and SOP documents stored in local JSON files.
- **Tool invocation:** typed file, report, email, calendar, and network
  capabilities.
- **Multi-step planning:** spoken intent and action evidence compile into an
  ordered procedure, constraints, permissions, tests, and proof artifacts.
- **Local memory:** versioned skill records with candidate, promoted,
  superseded, and revoked states.
- **Permission and privacy controls:** redaction, confirmation requirements,
  explicit denies, and server-authoritative evidence.

## Architecture

```text
Browser voice + six actions
          |
          v
Voice quality evidence + Qwen3-ASR on Radeon
          |
          v
Local policy retrieval + Qwen3 Agent compiler on Radeon
          |
          v
Typed constraints + capability policy + Agent Skill Markdown
          |
          v
Deterministic replay + adversarial tests + hashed receipts
          |
          v
Human promotion review + versioned skill memory
```

The public UI is hosted on Cloudflare Pages. A same-origin Pages Function adds a
server-held token and forwards API requests to the Radeon-hosted backend.
Direct unauthenticated backend requests are rejected.

Core inference and source audio processing run on the Radeon instance. The
public deployment provides a synthetic SOP fixture so no real confidential
material is needed when using the hosted application.

## Requirements

- Node.js 20+
- npm 10+
- Python 3 and FFmpeg only for media reproduction
- A Radeon/ROCm environment for reproducing measured GPU results

Install dependencies:

```bash
npm ci
```

Run the deterministic local application:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

Production build and API server:

```bash
npm run build
npm start
```

Open `http://127.0.0.1:8791`.

## Radeon Configuration

Copy `.env.example` to `.env` and configure the local OpenAI-compatible model
and ASR endpoints:

```bash
RADEON_OPENAI_BASE_URL=http://127.0.0.1:8000/v1
RADEON_MODEL=Qwen/Qwen3-4B-Instruct-2507
RADEON_ASR_BASE_URL=http://127.0.0.1:8001
RADEON_ASR_MODEL=Qwen/Qwen3-ASR-0.6B
RADEON_GPU_NAME="AMD Radeon Pro W7900-class gfx1100 48GB"
ROCM_VERSION="ROCm 7.2.1"
```

Start the supplied model services on the Radeon machine:

```bash
. /workspace/.venv-rvsf/bin/activate
python scripts/radeon_model_server.py
python scripts/radeon_asr_server.py
```

Then start the application:

```bash
npm start
```

## Measured Radeon Results

Environment:

- Radeon Pro W7900-class `gfx1100`, 47.98 GiB VRAM
- ROCm 7.2.1
- Qwen3-4B-Instruct-2507 FP16
- Qwen3-ASR-0.6B FP16

Core measurements:

- Agent median TTFT: 108.87 ms
- Agent median generation throughput: 22.02 tokens/s
- ASR warm median RTF: 0.0556, or 17.98x real-time
- Final audio-backed workflow: 7/7 verification fixtures
- Server-authoritative final permission: `mail.send = deny`

Targeted optimization:

- compact output: 29.42% fewer model output tokens
- compact output: 30.03% lower generation latency
- vLLM graph at concurrency eight: 257.65 aggregate output tokens/s
- serialized Transformers at concurrency eight: 20.66 output tokens/s
- same-hardware serving throughput ratio: 12.47x
- native Qwen3-ASR batch eight: 85.35x aggregate real-time

Exact reuse of an identical promoted skill measured 2.18 ms versus 24.09 s for
the recorded full compile request. This fast path avoids a repeat model call;
it is not presented as fresh-inference GPU acceleration.

Quark INT8 reduced model-load VRAM by 44.07% and increased KV-cache capacity by
88.43%, but it was slower and failed the policy-semantic acceptance gate. The
production recommendation remains FP16.

Raw data and methods:

- `benchmarks/radeon-audio-proof-v8-2026-07-18.json`
- `benchmarks/optimization-w7900-2026-07-17.json`
- `benchmarks/weekend-v10-summary.json`
- `benchmarks/quantization-v11-summary.json`
- `docs/RADEON_W7900_BENCHMARK.md`
- `docs/RADEON_OPTIMIZATION_BENCHMARK.md`
- `docs/WEEKEND_W7900_EXPERIMENTS.md`
- `docs/QUARK_QUANTIZATION_W7900_V11.md`

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The current suite contains 63 tests. Historical evidence files retain the test
counts from their pinned commits and are not combined into one remote run.

Run the optimization benchmark:

```bash
npm run benchmark:optimization -- benchmarks/optimization-latest.json
```

## Integrity and Threat Boundaries

- Voice Evidence values are internal deterministic signal-quality results, not
  ASR word-error-rate measurements.
- Governance receipts contain SHA-256 payload hashes; they are not digitally
  signed.
- The governance ledger checks sequence, previous-entry hashes, payload hashes,
  entry hashes, and consistency with skill memory. It is not externally
  anchored or Byzantine-resistant.
- The bundled governance ledger is the Product Demo sample and contains two
  promotion events. Supersede, revoke, and rollback remain implemented product
  lifecycle actions covered by the regression suite.
- The Product Demo's recorded `GAIA-compatible` phrase refers only to portable
  Agent Skill Markdown. No external GAIA conformance or certification is
  claimed.
- Raw audio is excluded from proof downloads.
- Changed intent must compile and verify again; only an identical promoted
  skill can use the reuse fast path.

## Demo Reproduction

```bash
AIDP_TTS_AK=... AIDP_TTS_VOICE=Charon \
  python3 scripts/generate_demo_tts.py
DEMO_PROJECT=review-followup-final-demo \
  node scripts/record_demo.mjs
python3 scripts/build_demo_video.py
```

Narration uses AIDP `gemini-3.1-flash-tts-preview`, voice `Charon`. Campaign
backgrounds use GPT Image 2. These tools are used only for presentation assets,
not for the product's core Agent or speech functions.
