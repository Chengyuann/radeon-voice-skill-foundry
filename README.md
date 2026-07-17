# Radeon Voice Skill Foundry

**Speak the SOP. Prove the Skill.**

Radeon Voice Skill Foundry is a Track 2 project for the AMD AI DevMaster
Hackathon. It turns a private spoken SOP and a structured workflow demonstration
into a GAIA-compatible Agent Skill with:

- typed SOP constraints
- least-privilege capability decisions
- positive and adversarial fixtures
- deterministic sandbox replay
- governance receipts
- a hash-bound proof bundle

The application runs without a model in deterministic fallback mode and has
also been validated with local Radeon inference.

Validated Radeon stack:

- Radeon Pro W7900-class allocation, gfx1100, 47.98 GiB VRAM
- ROCm 7.2.1
- Qwen3-4B-Instruct-2507 for Agent compilation
- Qwen3-ASR-0.6B for Chinese voice recognition
- Agent median TTFT: 108.87 ms
- Agent median throughput: 22.02 tokens/s
- ASR warm median RTF: 0.0556, approximately 17.98x real-time

## Run

Requirements:

- Node.js 20+
- npm 10+

```bash
npm install
npm run dev
```

Open the web app at `http://127.0.0.1:5173`.

Production build:

```bash
npm run build
npm start
```

Open `http://127.0.0.1:8791`.

## Demo workflow

1. Review or edit the spoken SOP transcript and aligned action trace.
2. Select `Compile spoken SOP`.
3. Inspect generated constraints, capabilities, tests, and `SKILL.md`.
4. Select `Run local verification`.
5. Inspect governance receipts and measured telemetry.
6. Download the proof ZIP.

## Radeon integration

Copy `.env.example` to `.env` and configure:

```bash
RADEON_OPENAI_BASE_URL=https://your-endpoint/v1
RADEON_MODEL=your-model-name
RADEON_API_KEY=...
```

Then enable **Radeon model adapter** in the UI. The adapter expects an
OpenAI-compatible `/chat/completions` endpoint with JSON response support.

Measured hardware evidence is in:

- `benchmarks/w7900-2026-07-17.json`
- `docs/RADEON_W7900_BENCHMARK.md`

Next optimization work:

- connect real audio upload/recording to the ASR model
- compare Transformers against vLLM or another optimized serving path
- compare sequential versus batched fixture generation
- compare full replanning versus verified-skill reuse

Radeon Cloud local model server:

```bash
. /workspace/.venv-rvsf/bin/activate
MODEL_ID=Qwen/Qwen3-4B-Instruct-2507 \
  python scripts/radeon_model_server.py
```

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

```text
Spoken SOP + action trace
          |
          v
Constraint compiler
          |
          v
GAIA SKILL.md + capability policy
          |
          v
Positive and adversarial fixtures
          |
          v
Deterministic sandbox + governance receipts
          |
          v
Hash-bound proof bundle
```

See:

- `docs/AMD_ALIGNMENT_RECOMMENDATION.md`
- `docs/RULES_AND_READINESS_AUDIT.md`
- `docs/RADEON_CLOUD_RUNBOOK.md`
- `docs/RADEON_W7900_BENCHMARK.md`
- `docs/VOICE_INTEGRATION.md`
- `docs/VOICE_SOP_FEASIBILITY_RESEARCH.md`
