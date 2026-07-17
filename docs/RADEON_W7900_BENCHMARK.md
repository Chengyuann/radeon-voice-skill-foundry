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

## Application verification

The project was copied to Radeon Cloud and verified with a public npm lock:

- `npm ci`: passed
- `npm run build`: passed
- unit tests: `3/3` passed
- final merged constraints: 8, including deterministic spoken-safety guardrails
- generated verification fixtures: `6/6` passed
- `mail.send`: denied by the spoken SOP guardrail
- governance receipts: 4
- proof hash:
  `a78e7cf2e67a483e34845561d9ee62d8402ffdccf11555219c1c6df2843cbe4d`
- proof ZIP SHA-256:
  `0f9a37f69aea24677561b3c43c2e5fbfa275aa0fadf0509816a7a8f1229879bd`

Raw data: `benchmarks/w7900-2026-07-17.json`.
