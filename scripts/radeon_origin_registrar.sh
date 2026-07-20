#!/usr/bin/env bash
set -euo pipefail

command_name="${1:-watch}"
runtime_dir="${RVSF_RUNTIME_DIR:-/workspace}"
origin_file="${RVSF_PUBLIC_ORIGIN_FILE:-$runtime_dir/rvsf-public-origin.txt}"
token_file="${RVSF_ORIGIN_RECOVERY_TOKEN_FILE:-$runtime_dir/.rvsf-origin-recovery-token}"
registered_file="$runtime_dir/rvsf-registered-origin.txt"
response_file="$runtime_dir/rvsf-origin-registration-response.json"
pages_origin="${RVSF_PAGES_ORIGIN:-https://radeon-voice-skill-foundry.pages.dev}"
recovery_url="${pages_origin%/}/internal/origin-recovery"
health_url="${pages_origin%/}/api/health"
poll_seconds="${RVSF_ORIGIN_POLL_SECONDS:-15}"
max_backoff_seconds="${RVSF_ORIGIN_MAX_BACKOFF_SECONDS:-120}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

require_secret_file() {
  if [[ ! -s "$token_file" ]]; then
    log "origin recovery token file is missing: $token_file" >&2
    exit 1
  fi
  local mode
  mode="$(stat -c '%a' "$token_file" 2>/dev/null || stat -f '%Lp' "$token_file")"
  if [[ "$mode" != "600" ]]; then
    log "origin recovery token file must have mode 600" >&2
    exit 1
  fi
}

current_origin() {
  [[ -s "$origin_file" ]] || return 1
  local origin
  origin="$(tr -d '\r\n' <"$origin_file")"
  if [[ "$origin" =~ ^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?\.trycloudflare\.com$ ]]; then
    printf '%s\n' "$origin"
    return
  fi
  return 1
}

registered_origin() {
  [[ -s "$registered_file" ]] && tr -d '\r\n' <"$registered_file"
}

pages_is_healthy() {
  curl --silent --show-error --fail \
    --max-time 10 \
    --output /dev/null \
    "$health_url"
}

register_origin() {
  local origin="$1"
  local token
  token="$(tr -d '\r\n' <"$token_file")"
  local temporary_response="${response_file}.tmp"

  if ! {
    printf 'silent\n'
    printf 'show-error\n'
    printf 'fail-with-body\n'
    printf 'max-time = 20\n'
    printf 'request = "POST"\n'
    printf 'url = "%s"\n' "$recovery_url"
    printf 'header = "content-type: application/json"\n'
    printf 'header = "x-rvsf-origin-recovery-token: %s"\n' "$token"
    printf 'data = "{\\"origin\\":\\"%s\\"}"\n' "$origin"
  } | curl --config - --output "$temporary_response"; then
    rm -f "$temporary_response"
    return 1
  fi

  mv "$temporary_response" "$response_file"
  printf '%s\n' "$origin" >"${registered_file}.tmp"
  mv "${registered_file}.tmp" "$registered_file"
}

run_once() {
  require_secret_file
  local origin
  if ! origin="$(current_origin)"; then
    log "no valid Quick Tunnel origin is available" >&2
    return 1
  fi

  local previous=""
  previous="$(registered_origin || true)"
  if [[ "$origin" == "$previous" ]] && pages_is_healthy; then
    return
  fi

  log "registering current Quick Tunnel origin"
  if ! register_origin "$origin"; then
    log "origin registration failed" >&2
    return 1
  fi
  if ! pages_is_healthy; then
    log "Pages API did not become healthy after registration" >&2
    return 1
  fi
  log "origin registration verified through the stable Pages URL"
}

watch() {
  local backoff="$poll_seconds"
  while true; do
    if run_once; then
      backoff="$poll_seconds"
      sleep "$poll_seconds"
      continue
    fi
    sleep "$backoff"
    backoff=$((backoff * 2))
    if ((backoff > max_backoff_seconds)); then
      backoff="$max_backoff_seconds"
    fi
  done
}

status() {
  local origin=""
  local registered=""
  origin="$(current_origin || true)"
  registered="$(registered_origin || true)"
  printf 'origin=%s\n' "${origin:-unavailable}"
  printf 'registered=%s\n' "${registered:-unavailable}"
  if pages_is_healthy; then
    printf 'pages_api=healthy\n'
  else
    printf 'pages_api=unavailable\n'
    return 1
  fi
}

case "$command_name" in
  once)
    run_once
    ;;
  watch)
    watch
    ;;
  status)
    status
    ;;
  *)
    echo "usage: $0 {once|watch|status}" >&2
    exit 2
    ;;
esac
