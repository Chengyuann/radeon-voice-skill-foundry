#!/usr/bin/env bash
set -euo pipefail

repo_dir="${RVSF_REPO_DIR:-/workspace/radeon-voice-skill-foundry-current}"
runtime_dir="${RVSF_RUNTIME_DIR:-/workspace}"
api_port="${RVSF_PUBLIC_API_PORT:-8792}"
token_file="${RVSF_API_TOKEN_FILE:-$runtime_dir/.rvsf-api-token}"

if [[ ! -s "$token_file" ]]; then
  echo "required API token file is missing: $token_file" >&2
  exit 1
fi

cd "$repo_dir"
export PORT="$api_port"
export HOST=127.0.0.1
export RVSF_API_TOKEN="$(tr -d '\r\n' <"$token_file")"
export RADEON_OPENAI_BASE_URL="${RADEON_OPENAI_BASE_URL:-http://127.0.0.1:8000/v1}"
export RADEON_MODEL="${RADEON_MODEL:-Qwen/Qwen3-4B-Instruct-2507}"
export RADEON_ASR_BASE_URL="${RADEON_ASR_BASE_URL:-http://127.0.0.1:8001}"
export RADEON_ASR_MODEL="${RADEON_ASR_MODEL:-Qwen/Qwen3-ASR-0.6B}"
export RADEON_GPU_NAME="${RADEON_GPU_NAME:-AMD Radeon Pro W7900-class gfx1100 48GB}"
export ROCM_VERSION="${ROCM_VERSION:-ROCm 7.2.1}"
export RADEON_ASR_RTF="${RADEON_ASR_RTF:-0.0556}"
export RADEON_ASR_X_REALTIME="${RADEON_ASR_X_REALTIME:-17.98}"
export RADEON_ASR_PEAK_VRAM_GIB="${RADEON_ASR_PEAK_VRAM_GIB:-1.752}"
export RVSF_DATA_DIR="${RVSF_DATA_DIR:-$runtime_dir/.rvsf-live-data}"

exec ./node_modules/.bin/tsx server/index.ts
