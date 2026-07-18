# Radeon Optimization Benchmark

Measured: 2026-07-17 (UTC+8)

## Objective

This experiment targets two Track 2 optimization claims:

1. reduce local Agent compilation cost without weakening safety semantics
2. avoid full replanning when an identical Verified Skill already exists

The benchmark was executed on the same Radeon Cloud allocation used by the
voice-to-skill demo.

## Environment

- GPU: AMD Radeon Pro W7900-class, `gfx1100`, 48 GiB
- ROCm: 7.2.1
- Model: `Qwen/Qwen3-4B-Instruct-2507`
- Serving: Transformers, FP16, deterministic generation
- ASR service: `Qwen/Qwen3-ASR-0.6B`, healthy during the experiment
- Application: Radeon Voice Skill Foundry

## Experiment A: Compact Structured Output

### Baseline

The model generated every final constraint field:

- `id`
- `confidence`
- `kind`
- `statement`
- `sourceText`
- `appliesTo`

Maximum output was 900 tokens.

### Optimized protocol

The model generated semantic fields only:

- `kind`
- `statement`
- `sourceText`
- `appliesTo`

The TypeScript runtime generated IDs and calibrated confidence values. Maximum
output was reduced to 520 tokens. A JSON-repair fallback retains a 900-token
ceiling for unusually long or truncated outputs. The prompt also required:

- compensation and other sensitive-output exclusions to produce `redact`
- prohibited sending to produce `must_not`
- allowed work and prohibited side effects to remain separate atomic rules

### Method

- identical SOP, action trace, policy context, model, server, and GPU
- three steady-state runs for each protocol
- median reported for latency and tokens
- raw constraints retained in the benchmark JSON
- semantic pass required every run to contain:
  - a `must_not` constraint covering email sending
  - a `redact` constraint covering compensation data

### Results

| metric | baseline | compact | change |
|---|---:|---:|---:|
| median request duration | 30,808.37 ms | 21,557.62 ms | -30.03% |
| median generation latency | 30,799.89 ms | 21,549.23 ms | -30.03% |
| median TTFT | 143.54 ms | 160.90 ms | +17.36 ms |
| median output tokens | 656 | 463 | -29.42% |
| median throughput | 21.30 tok/s | 21.49 tok/s | +0.19 tok/s |
| semantic gate | pass | pass | preserved |

The latency improvement comes from generating fewer tokens, not from claiming
a higher token generation rate. TTFT was slightly higher in this sample, while
total completion latency improved materially.

## Experiment B: Verified Skill Reuse

The optimized product flow compiled and verified the SOP, saved it to the local
Verified Skill Registry, then reused the exact stored skill five times.

### Full optimized compilation

- HTTP round-trip: `24,093.42 ms`
- internal compile duration: `24,081.20 ms`
- model output: `506` tokens
- peak allocated VRAM: `7.825 GiB`
- generated constraints: `11`
- `mail.send`: `deny`
- verification: `6/6` fixtures passed

### Exact reuse

| sample | server latency | HTTP round-trip |
|---|---:|---:|
| 1 | 0.88 ms | 2.64 ms |
| 2 | 1.01 ms | 2.36 ms |
| 3 | 0.85 ms | 2.03 ms |
| 4 | 0.79 ms | 2.18 ms |
| 5 | 0.83 ms | 2.07 ms |
| median | **0.85 ms** | **2.18 ms** |

Measured speedup using HTTP round-trip latency:

`24,093.42 / 2.18 = 11,052.03x`

Each exact reuse avoided 506 model output tokens.

## Product Impact

The two optimizations serve different stages:

- compact output accelerates first-time Voice-to-Verified-Skill compilation
- procedural memory makes repeated execution use the already-proven artifact
  instead of regenerating policy, fixtures, and skill metadata

This supports the AMD-facing product thesis: Radeon handles private first-time
voice understanding and verification locally, while Verified Skill memory makes
subsequent use effectively immediate.

## Limitations

- The direct model A/B uses three runs per variant; it is hackathon evidence,
  not a production-scale statistical study.
- Full compilation is one end-to-end sample captured during the final benchmark.
- The `11,052x` result applies to exact retrieval of an identical Verified
  Skill. It does not apply to changed SOPs, semantic skill search, or arbitrary
  Agent replanning.
- The original Transformers FP16 serving path remains the reproducible
  baseline. The isolated weekend study measured vLLM eager and graph modes:
  concurrency-eight aggregate throughput increased from 20.66 to 257.65
  tokens/s. The main gain came from continuous batching; graph mode added
  1.51% over eager after a 35.88-second first-start compilation. See
  `docs/WEEKEND_W7900_EXPERIMENTS.md`.

## Reproduce

With the Radeon model server and application running:

```bash
RADEON_OPENAI_BASE_URL=http://127.0.0.1:8000/v1 \
RADEON_MODEL=Qwen/Qwen3-4B-Instruct-2507 \
RVSF_APP_BASE_URL=http://127.0.0.1:8791 \
npm run benchmark:optimization -- benchmarks/optimization-latest.json
```

Raw evidence:

- `benchmarks/optimization-w7900-2026-07-17.json`
- SHA-256:
  `ce2848f92c7f93b30fe558c99128cb6eba1988319931f7ab0bdcc803d291298d`
