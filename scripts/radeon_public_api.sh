#!/usr/bin/env bash
set -euo pipefail

command_name="${1:-status}"
repo_dir="${RVSF_REPO_DIR:-/workspace/radeon-voice-skill-foundry-live}"
runtime_dir="${RVSF_RUNTIME_DIR:-/workspace}"
api_port="${RVSF_PUBLIC_API_PORT:-8792}"
token_file="${RVSF_API_TOKEN_FILE:-$runtime_dir/.rvsf-api-token}"
api_pid_file="$runtime_dir/rvsf-live-api.pid"
api_log="$runtime_dir/rvsf-live-api.log"
tunnel_pid_file="$runtime_dir/rvsf-cloudflared.pid"
tunnel_log="$runtime_dir/rvsf-cloudflared.log"
origin_file="$runtime_dir/rvsf-public-origin.txt"
cloudflared_bin="${CLOUDFLARED_BIN:-$runtime_dir/cloudflared}"

require_file() {
  if [[ ! -s "$1" ]]; then
    echo "required file is missing: $1" >&2
    exit 1
  fi
}

check_health() {
  local label="$1"
  local url="$2"
  if ! curl -fsS --max-time 5 "$url" >/dev/null; then
    echo "$label is unavailable at $url" >&2
    exit 1
  fi
}

pid_is_running() {
  local pid_file="$1"
  [[ -s "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

start_api() {
  if pid_is_running "$api_pid_file"; then
    return
  fi
  local token
  token="$(cat "$token_file")"
  cd "$repo_dir"
  nohup env \
    PORT="$api_port" \
    HOST=127.0.0.1 \
    RVSF_API_TOKEN="$token" \
    RADEON_OPENAI_BASE_URL=http://127.0.0.1:8000/v1 \
    RADEON_MODEL=Qwen/Qwen3-4B-Instruct-2507 \
    RADEON_ASR_BASE_URL=http://127.0.0.1:8001 \
    RADEON_ASR_MODEL=Qwen/Qwen3-ASR-0.6B \
    RADEON_GPU_NAME="AMD Radeon Pro W7900-class gfx1100 48GB" \
    ROCM_VERSION="ROCm 7.2.1" \
    RADEON_ASR_RTF=0.0556 \
    RADEON_ASR_X_REALTIME=17.98 \
    RADEON_ASR_PEAK_VRAM_GIB=1.752 \
    RVSF_DATA_DIR="$runtime_dir/.rvsf-live-data" \
    ./node_modules/.bin/tsx server/index.ts \
    >"$api_log" 2>&1 </dev/null &
  echo "$!" >"$api_pid_file"

  for _ in $(seq 1 40); do
    if curl -fsS --max-time 3 \
      -H "x-rvsf-api-token: $token" \
      "http://127.0.0.1:$api_port/api/health" >/dev/null; then
      return
    fi
    sleep 0.5
  done
  echo "RVSF API did not become healthy; inspect $api_log" >&2
  exit 1
}

start_tunnel() {
  if pid_is_running "$tunnel_pid_file"; then
    return
  fi
  : >"$tunnel_log"
  nohup "$cloudflared_bin" tunnel \
    --no-autoupdate \
    --protocol http2 \
    --url "http://127.0.0.1:$api_port" \
    >"$tunnel_log" 2>&1 </dev/null &
  echo "$!" >"$tunnel_pid_file"

  local origin=""
  for _ in $(seq 1 100); do
    origin="$(
      grep -Eo "https://[-a-z0-9]+\.trycloudflare\.com" "$tunnel_log" |
        tail -1 || true
    )"
    if [[ -n "$origin" ]]; then
      printf '%s\n' "$origin" >"$origin_file"
      return
    fi
    sleep 0.5
  done
  echo "Cloudflare Tunnel did not publish an origin; inspect $tunnel_log" >&2
  exit 1
}

stop_pid_file() {
  local pid_file="$1"
  if pid_is_running "$pid_file"; then
    kill "$(cat "$pid_file")"
  fi
}

status() {
  local api_state="stopped"
  local tunnel_state="stopped"
  pid_is_running "$api_pid_file" && api_state="running"
  pid_is_running "$tunnel_pid_file" && tunnel_state="running"
  echo "api=$api_state port=$api_port"
  echo "tunnel=$tunnel_state"
  if [[ -s "$origin_file" ]]; then
    echo "origin=$(cat "$origin_file")"
  else
    local origin
    origin="$(
      grep -Eo "https://[-a-z0-9]+\.trycloudflare\.com" "$tunnel_log" 2>/dev/null |
        tail -1 || true
    )"
    [[ -n "$origin" ]] && echo "origin=$origin"
  fi
}

case "$command_name" in
  start)
    require_file "$token_file"
    require_file "$cloudflared_bin"
    check_health "Qwen3 model" "http://127.0.0.1:8000/health"
    check_health "Qwen3 ASR" "http://127.0.0.1:8001/health"
    start_api
    start_tunnel
    status
    ;;
  stop)
    stop_pid_file "$tunnel_pid_file"
    stop_pid_file "$api_pid_file"
    ;;
  status)
    status
    ;;
  *)
    echo "usage: $0 {start|status|stop}" >&2
    exit 2
    ;;
esac
