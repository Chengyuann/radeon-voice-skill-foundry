# Radeon Cloud W7900 Benchmark

Measured: 2026-07-17 (UTC+8)

## Environment

- Allocation: Radeon Pro W7900-class, confirmed by `gfx1100` and 47.98 GiB VRAM
- Driver-reported name: `AMD Radeon Graphics`
- ROCm: `7.2.1`
- Driver: `6.16.13`
- PyTorch: `2.8.0+rocm7.2.1.lw.gitd733adb1`
- HIP runtime: `7.2.53211-e1a6bc5663`
- Triton: `3.4.0+rocm7.2.1.git0cace8d2`

## GPU smoke

4096 x 4096 matrix multiplication, 10 measured iterations after warmup:

| dtype | throughput |
|---|---:|
| FP32 | 2.59 TFLOPS |
| FP16 | 63.87 TFLOPS |

## Local Agent model

Model: `Qwen/Qwen3-4B-Instruct-2507`, Transformers, FP16.

Three steady-state SOP compilation runs:

- median TTFT: `108.87 ms`
- median throughput: `22.02 tokens/s`
- peak allocated VRAM: `7.72 GiB`
- complete structured SOP compilation: about `21.51 s`

The model produced valid structured constraints and the deterministic verifier
completed the proof path.

## Local ASR model

Model: `Qwen/Qwen3-ASR-0.6B`, Transformers, FP16.

Official Chinese sample:

- audio duration: `4.204 s`
- recognized text: `甚至出现交易几乎停滞的情况。`
- cold inference RTF: `0.3313`
- warm median inference: `0.2339 s`
- warm median RTF: `0.0556`
- warm throughput: about `17.98x real-time`
- peak allocated VRAM: `1.752 GiB`

End-to-end synthetic SOP voice fixture:

- browser-compatible WAV duration: `20.3898 s`
- ASR transcription:
  `项目评审之后，之处理P零和P一问题。外部报告里不能包含薪资数据。邮件只能生成草稿，不要自动发送。如果负责人缺失，必须标记为需要确认。只有存在截止日期时，才创建日历站位。`
- upload endpoint inference: `5.5021 s`
- upload endpoint RTF: `0.2698`
- upload endpoint speed: `3.71x real-time`
- semantic guardrail promoted the recognized no-send rule to `must_not`
- final permission: `mail.send = deny`
- final fixtures: `6/6` passed
- final voice-pipeline proof hash:
  `a9d7a6c2046e0b524b31d1126eb665257fef8e93924c4b6d7847cbe9b8ae0438`

The test audio was generated locally as a reproducible demo fixture; it is not
presented as a human recording.

## Local RAG and procedural memory

Validated on the same Radeon Cloud workspace:

- retrieved 3 local documents for the voice SOP
  - Project Review Follow-up SOP
  - Email and Calendar Action Policy
  - External Reporting and Privacy Policy
- natural-language refinement created revision 2 with a parent run reference
- "Always require confirmation before creating calendar holds" was compiled
  into a `requires_confirmation` rule
- refined skill verification passed
- verified skill persisted as version 1
- reuse count incremented from 0 to 1

## Radeon optimization experiment

The final optimization benchmark used the same W7900-class allocation,
Qwen3-4B model, ROCm 7.2.1 runtime, and Transformers FP16 serving path.

Compact structured-output protocol, three steady-state runs per variant:

| metric | baseline | compact | change |
|---|---:|---:|---:|
| median output tokens | 656 | 463 | -29.42% |
| median generation latency | 30.80 s | 21.55 s | -30.03% |
| median throughput | 21.30 tok/s | 21.49 tok/s | +0.89% |
| semantic gate | pass | pass | preserved |

The semantic gate required every run to produce:

- a `must_not` rule for sending email
- a `redact` rule covering compensation data

Full optimized product flow:

- full compilation HTTP round-trip: `24,093.42 ms`
- model output: `506` tokens
- peak allocated VRAM: `7.825 GiB`
- final `mail.send`: `deny`
- verification: `6/6` fixtures passed

Exact Verified Skill reuse, five HTTP calls:

- median server-side retrieval/update: `0.85 ms`
- median HTTP round-trip: `2.18 ms`
- speedup versus the measured full compilation: `11,052.03x`
- model output avoided per reuse: `506` tokens

This reuse comparison measures an exact, already-verified skill lookup, not a
changed task or approximate semantic match. It demonstrates the procedural
memory fast path without claiming the same ratio for all Agent workloads.

Detailed method and limitations:
`docs/RADEON_OPTIMIZATION_BENCHMARK.md`.

Raw data:
`benchmarks/optimization-w7900-2026-07-17.json`.

## Final Voice Evidence Gate rerun

Measured on 2026-07-18 using source commit
`c759a417c68d06f639e3df797f50b4ebd7b81091`:

- `npm ci`: passed
- unit tests: `21/21` passed
- production build: passed
- Qwen3-ASR 20.39-second SOP inference: `1.4259 s`
- ASR RTF: `0.0699` (`14.3x` real-time)
- ASR peak allocated VRAM: `1.661 GiB`
- Voice Evidence Gate: `100/100`
- Qwen3-4B compile duration: `24.1331 s`
- Agent TTFT: `368.16 ms`
- Agent throughput: `20.07 tokens/s`
- Agent peak allocated VRAM: `8.001 GiB`
- generated constraints: `13`
- verification: `7/7` fixtures passed
- final `mail.send`: `deny`
- governance BLOCK receipts: `3`
- proof hash:
  `6ff30ccc2d052e226051fa6819760abe3b2c2ef6243b63169ab9d5e0caebfc40`
- proof ZIP SHA-256:
  `6ea53dfe28f8221b3db9b06e6eed537767bf28b4c6536d25d45f3ffec20500e9`

The verification request intentionally changed the client-side `mail.send`
permission to `allow` and replaced its action trace. The server ignored those
untrusted fields, resolved the authoritative compile run, and still returned
`mail.send = deny` with `7/7` fixtures.

Raw summary:
`benchmarks/radeon-audio-proof-v8-2026-07-18.json`.

## Application verification

The project was copied to Radeon Cloud and verified with a public npm lock:

- `npm ci`: passed
- `npm run build`: passed
- unit tests: `10/10` passed
- final merged constraints: 8, including deterministic spoken-safety guardrails
- generated verification fixtures: `6/6` passed
- `mail.send`: denied by the spoken SOP guardrail
- governance receipts: 4
- proof hash:
  `a78e7cf2e67a483e34845561d9ee62d8402ffdccf11555219c1c6df2843cbe4d`
- proof ZIP SHA-256:
  `0f9a37f69aea24677561b3c43c2e5fbfa275aa0fadf0509816a7a8f1229879bd`

Raw data: `benchmarks/w7900-2026-07-17.json`.
