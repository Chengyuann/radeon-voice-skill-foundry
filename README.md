# Radeon Voice Skill Foundry

**Speak the SOP. Prove the Skill.**

Final 3-minute 49-second demo:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/RADEON_VOICE_SKILL_FOUNDRY_DEMO.mp4`

Continuous 3-minute 10-second operation demo:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/CONTINUOUS_OPERATION_DEMO.mp4`

Official AMD hackathon submission:
`https://github.com/AMD-DEV-CONTEST/Radeon-hackathon-2026-07/pull/7`

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

- a Motion Sites-inspired full-bleed 3D product hero using the locally hosted
  `public/media/radeon-foundry-hero.mp4`
- React Bits-inspired interaction patterns adapted for this workbench:
  DecryptedText, CountUp, SpotlightCard, AnimatedContent, Magnet, and Stepper
- microphone recording
- local audio upload
- browser-side conversion to 16 kHz mono WAV
- server-authoritative Voice Evidence Gate for level, clipping, silence, format,
  source hash, and ASR transcript hash
- persistent Qwen3-ASR transcription on Radeon
- automatic transcript-to-SOP compilation
- generated permission guardrails, tests, receipts, and proof ZIP
- local policy/SOP RAG with retrieved evidence
- persistent verified-skill memory with versioning and reuse counts
- measured full-compilation versus verified-skill reuse speedup
- multi-turn natural-language constraint refinement
- compact model output with runtime-owned IDs and confidence metadata
- proof-bound `pass` / `review` / `quarantine` handling for audio evidence
- Voice Evidence v0.3 diagnostics for estimated SNR, noise floor, speech
  level, crest factor, DC offset, short dropouts, multi-frame burst loss, and
  channel imbalance
- atomically persisted voice evidence, trusted compile runs, and verification
  results that survive service restart
- proof compatibility manifests that invalidate reuse when the runtime, tools,
  policy, skill, verifier, or evidence schema changes
- one-click revalidation that creates a new child proof for the current runtime

Local state is stored atomically under `.rvsf-data/`:

- `knowledge.json`: policy and SOP documents
- `skills.json`: verified skill versions, proof evidence, and reuse counters
- `voice-evidence-records.json`: source-bound audio evidence
- `trusted-compile-runs.json`: server-authoritative compile records
- `trusted-verification-runs.json`: durable proof records

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

1. Review the spoken SOP transcript and aligned action trace. Editing the ASR
   transcript requires explicit acknowledgement before skill promotion.
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
- `benchmarks/radeon-audio-proof-v8-2026-07-18.json`
- `benchmarks/lifecycle-enhancements-v9-2026-07-18.json`
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

The repository's synthetic Chinese SOP WAV also passes the local Voice Evidence
Gate at `100/100`: 20.39 seconds, 16 kHz mono, -18.36 dBFS RMS, zero clipping,
and 17.17% near-silence. The proof bundle stores server-held derived metrics,
the source SHA-256, the original ASR transcript hash, and whether the transcript
was edited and reviewed. It does not include raw audio.

The final Radeon audio-backed rerun used source commit `c759a41` and passed
`21/21` tests, the production build, and `7/7` verification fixtures. The
20.39-second SOP WAV transcribed in 1.426 seconds (`0.0699` RTF, `14.3x`
real-time). Qwen3-4B compiled 13 constraints in 24.13 seconds with 368 ms TTFT,
20.07 tokens/s, and 8.001 GiB peak VRAM. The server preserved
`mail.send = deny` even when the client verification payload was modified.

Release artifacts include the narrated demo, SRT captions, visual campaign
assets, and the final Radeon proof ZIP. Narration uses AIDP
`gemini-3.1-flash-tts-preview` with the male `Charon` voice. Both demo MP4 files
contain burned-in English narration captions and an embedded English subtitle
track. GPT Image 2 generated the cinematic background artwork; project names,
labels, and metrics are rendered locally for exact typography. Product footage
is explicitly labeled as a deterministic replay, while runtime screenshots and
metrics come from the actual Radeon Cloud validation.

Weekend W7900 experiments now include an isolated Transformers versus vLLM
comparison, native ASR batching, acoustic robustness, and Voice Evidence v0.3.
At eight concurrent heterogeneous SOP requests, vLLM graph mode measured
257.65 aggregate output tokens/s versus 20.66 for the serialized Transformers
server, a 12.47x throughput improvement. Native Qwen3-ASR batch-eight reached
85.35x aggregate real-time and was 6.66x faster than sequential inference.
The experiments also found a 280 ms burst-loss blind spot in Voice Evidence
v0.2; v0.3 now quarantines that sample and invalidates older proofs until
revalidation. See `docs/WEEKEND_W7900_EXPERIMENTS.md` and
`benchmarks/weekend-v10-summary.json`.

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
Voice Evidence Gate
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
- `docs/VOICE_AI_SPACE_SIGNALS_2026-07-18.md`
