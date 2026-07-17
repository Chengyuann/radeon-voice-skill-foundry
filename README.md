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

The web UI now supports:

- microphone recording
- local audio upload
- browser-side conversion to 16 kHz mono WAV
- persistent Qwen3-ASR transcription on Radeon
- automatic transcript-to-SOP compilation
- generated permission guardrails, tests, receipts, and proof ZIP
- local policy/SOP RAG with retrieved evidence
- persistent verified-skill memory with versioning and reuse counts
- measured full-compilation versus verified-skill reuse speedup
- multi-turn natural-language constraint refinement
- compact model output with runtime-owned IDs and confidence metadata

Local state is stored under `.rvsf-data/`:

- `knowledge.json`: policy and SOP documents
- `skills.json`: verified skill versions, proof evidence, and reuse counters

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
- `benchmarks/optimization-w7900-2026-07-17.json`
- `docs/RADEON_W7900_BENCHMARK.md`
- `docs/RADEON_OPTIMIZATION_BENCHMARK.md`

Measured optimization results on the same Radeon allocation:

- compact structured output reduced median model output from 656 to 463
  tokens (`29.42%`)
- median generation latency fell from 30.80 s to 21.55 s (`30.03%`)
- all compact runs retained the required compensation-redaction and no-send
  semantics
- verified-skill reuse took 2.18 ms median HTTP round-trip versus a 24.09 s
  full compilation (`11,052x` for exact verified-skill reuse)

The next isolated serving experiment is Transformers versus vLLM. It should run
in a separate template or container so the validated Transformers environment
remains reproducible.

Radeon Cloud local model server:

```bash
. /workspace/.venv-rvsf/bin/activate
MODEL_ID=Qwen/Qwen3-4B-Instruct-2507 \
  python scripts/radeon_model_server.py
```

Persistent Radeon ASR service:

```bash
. /workspace/.venv-rvsf/bin/activate
python scripts/radeon_asr_server.py
```

## Verify

```bash
npm run typecheck
npm test
npm run build
```

Radeon optimization benchmark:

```bash
npm run benchmark:optimization -- benchmarks/optimization-latest.json
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
