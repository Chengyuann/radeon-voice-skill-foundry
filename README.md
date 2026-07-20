# Radeon Voice Skill Foundry

**Speak the SOP. Prove the Skill.**

Recommended 4-minute 49-second live Cloudflare + W7900 Demo V2:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/RADEON_VOICE_SKILL_FOUNDRY_DEMO_V2.mp4`

Demo V2 captions:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/RADEON_VOICE_SKILL_FOUNDRY_DEMO_V2.srt`

Original 3-minute 49-second overview:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/RADEON_VOICE_SKILL_FOUNDRY_DEMO.mp4`

Continuous 4-minute 20-second lifecycle Demo V2:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/CONTINUOUS_OPERATION_DEMO_V2.mp4`

Continuous Demo V2 captions:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/CONTINUOUS_OPERATION_DEMO_V2.srt`

Continuous Demo V2 child proof:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/continuous-demo-v2-proof.zip`

Original continuous operation demo:
`https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/final-submission-v1/CONTINUOUS_OPERATION_DEMO.mp4`

Official AMD hackathon submission:
`https://github.com/AMD-DEV-CONTEST/Radeon-hackathon-2026-07/pull/7`

Judge scoring matrix:
`submission/SCORING_EVIDENCE_MATRIX.md`

Radeon Voice Skill Foundry is a Track 2 project for the AMD AI DevMaster
Hackathon. It turns a private spoken SOP and a structured workflow demonstration
into a GAIA-compatible Agent Skill with:

- typed SOP constraints
- least-privilege capability decisions
- positive and adversarial fixtures
- deterministic sandbox replay
- step-by-step Sandbox Replay v1 with state hashes, changed fields, controlled
  outputs, and five fail-closed adversarial probes
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
- a deterministic project-review workspace whose real user commands generate
  the aligned action trace instead of loading a preset trace
- server-authoritative demonstration sessions that reject out-of-order
  commands and ignore browser-supplied action tampering during compilation
- six ordered teaching actions: open review, filter P0/P1, review missing
  ownership, draft email, draft calendar holds, and export a redacted report
- safe simulated outputs that never send email or commit calendar invitations
- browser-side conversion to 16 kHz mono WAV
- server-authoritative Voice Evidence Gate for level, clipping, silence, format,
  source hash, and ASR transcript hash
- persistent Qwen3-ASR transcription on Radeon
- automatic transcript-to-SOP compilation
- generated permission guardrails, tests, receipts, and proof ZIP
- proof-bound `sandbox_replay.json` with six execution steps and five probes
- local policy/SOP RAG with retrieved evidence
- persistent verified-skill memory with versioning and reuse counts
- explicit skill governance lifecycle: candidate, promoted, superseded, and
  revoked
- human promotion gate bound to the current proof hash, reasoned revocation,
  immutable history, and verified rollback into a new version
- server-generated Promotion Impact Review comparing permissions, constraints,
  actions, and runtime with the current promoted baseline
- hash-bound approval that rejects stale reviews and requires explicit
  acknowledgement for risk escalation
- append-only Governance Audit Ledger with sequence, previous hash, payload
  hash, entry hash, receipt reconciliation, and JSONL export
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

## Public Cloudflare deployment

The production web app is deployed on Cloudflare Pages. Browser requests remain
same-origin under `/api`; `functions/api/[[path]].ts` forwards those requests to
the Radeon-hosted API and injects `RVSF_API_TOKEN`.

**Live demo:** https://radeon-voice-skill-foundry.pages.dev/

Required Pages secrets and binding:

```text
RVSF_API_TOKEN=<shared-random-token>
RVSF_ORIGIN_RECOVERY_TOKEN=<independent-random-token>
RVSF_ORIGIN_REGISTRY=<Cloudflare KV binding>
RADEON_API_ORIGIN=https://<fallback-radeon-tunnel-host>
```

The same token must be present in the W7900 Node process. Local development does
not require it. `RADEON_API_ORIGIN` is a fallback; production first resolves
`radeon-api-origin` from the KV registry. Build and deploy with:

```bash
npm run deploy:pages
```

The public app is only a complete demo while the W7900 services are available:

```text
8000  Qwen3-4B OpenAI-compatible model server
8001  Qwen3-ASR-0.6B service
8791  Radeon Voice Skill Foundry API
```

On the W7900 workspace, the API, Quick Tunnel, and origin registrar run under
Supervisor. The tunnel wrapper writes every newly issued URL to
`/workspace/rvsf-public-origin.txt`; the registrar authenticates to
`/internal/origin-recovery`, where Pages verifies the candidate against the
server-held API token before updating KV.

Recover or inspect the authenticated public stack with:

```bash
bash scripts/radeon_public_api.sh start
bash scripts/radeon_public_api.sh status
```

The recovery token exists only as an encrypted Pages secret and a mode-`600`
file on W7900. A Quick Tunnel restart no longer requires a Pages redeploy.
The old manual rotation script remains an emergency fallback:

```bash
bash scripts/update_cloudflare_origin.sh https://<new-origin>
```

## Demo workflow

1. Record or upload the spoken SOP.
2. Perform the six commands in the project-review workspace. Each command is
   accepted and persisted by the server before the UI advances.
3. Review the transcript. Editing the ASR transcript requires explicit
   acknowledgement before skill promotion.
4. Select `Compile voice + actions`.
5. Inspect generated constraints, capabilities, tests, and `SKILL.md`.
6. Select `Run local verification`.
7. Inspect governance receipts and measured telemetry.
8. Download the proof ZIP, including `action_contract.json`.

## Reproduce Demo V2

Demo V2 records the public Cloudflare deployment and real W7900 workflow. It
uses AIDP `gemini-3.1-flash-tts-preview`, male voice `Charon`, with burned-in
English captions and an embedded English subtitle track.

```bash
AIDP_TTS_AK=... AIDP_TTS_VOICE=Charon \
  python3 scripts/generate_demo_v2_tts.py
node scripts/record_demo_v2.mjs
python3 scripts/build_demo_v2_video.py
```

The companion continuous lifecycle Demo V2 uses deterministic ASR and compiler
fixtures so service restarts are reproducible in one take. It performs two
real Node API process restarts, durable recovery, runtime drift, proof
invalidation, child-run revalidation, and proof download:

```bash
AIDP_TTS_AK=... AIDP_TTS_VOICE=Charon \
  python3 scripts/generate_continuous_demo_v2_tts.py
CONTINUOUS_V2_MODE=local node scripts/record_continuous_demo_v2.mjs
python3 scripts/build_continuous_demo_v2_video.py
```

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

The pinned final Radeon audio-backed rerun used source commit `c759a41` and
passed `21/21` tests, the production build, and `7/7` verification fixtures. The
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

The current local suite has since grown to `56/56` and passes typecheck and the
production build. The main Demo V2 is the real Cloudflare-to-W7900 inference
evidence. Continuous Demo V2 uses deterministic ASR/compiler fixtures with real
Node process restarts and is used only for durability, invalidation, and proof
lineage evidence.

Sandbox Replay v1 is a deterministic product-verification enhancement, not a
new GPU performance claim. It replays the trusted six-step action contract
against an isolated local state machine, records before/after hashes and output
diffs, then runs probes for automatic email sending, P2 scope escape, sensitive
report leakage, missing-owner guessing, and network writes. Any failed step or
probe quarantines the skill.

Verified output is first saved as a promotion candidate. Exact reuse remains
blocked until a human promotes that proof-compatible version. Promoting a newer
version supersedes the previous promoted version. Revocation requires a reason,
and rollback never mutates history: it revalidates the selected historical
version under the current runtime and creates a new promoted version with a
governance receipt.

Before promotion, the Memory module displays a server-generated impact diff and
risk rating. Approval submits the review hash back to the server; if the
candidate proof or promoted baseline changed, the approval is rejected as
stale. Permission escalation, removed `must_not`/`redact` guardrails, and a new
`send_email` action require explicit risk acknowledgement.

Every Promotion, Supersede, Revoke, and Rollback receipt is appended to a
separate Governance Audit Ledger. The ledger verifies sequence order,
previous-hash links, payload and entry hashes, duplicate receipt IDs, and
bidirectional consistency with skill memory. Payload tampering or deleted tail
or middle entries mark the ledger `invalid`; the full chain is exportable as
JSONL.

Quark quantization v11 tested INT4 W4A16 export and INT8 W8A8 serving on the
same W7900. INT8 reduced model-load VRAM by 44.07% and increased KV-cache
capacity by 88.43%, but was 36.70% slower at concurrency eight and preserved
all policy semantics in only 11/51 samples versus FP16 at 51/51. The project
therefore keeps FP16 and rejects the INT8 artifact. See
`docs/QUARK_QUANTIZATION_W7900_V11.md`.

Adaptive Precision Controller v12 then tested whether JSON Schema could recover
the degraded INT8 model. Strict JSON improved from 0/12 to 2/12, but semantic
admission remained 0/12. A fail-closed controller automatically selected FP16
for all 12 requests and restored 12/12 accepted outputs. A real audio-backed
product run recorded `selected = fallback` in the proof core, preserved
`mail.send = deny`, and passed 7/7. See
`docs/ADAPTIVE_PRECISION_CONTROLLER_V12.md`.

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
- `submission/SCORING_EVIDENCE_MATRIX.md`
- `docs/RADEON_CLOUD_RUNBOOK.md`
- `docs/RADEON_W7900_BENCHMARK.md`
- `docs/QUARK_QUANTIZATION_W7900_V11.md`
- `docs/ADAPTIVE_PRECISION_CONTROLLER_V12.md`
- `docs/VOICE_INTEGRATION.md`
- `docs/VOICE_SOP_FEASIBILITY_RESEARCH.md`
- `docs/VOICE_AI_SPACE_SIGNALS_2026-07-18.md`
