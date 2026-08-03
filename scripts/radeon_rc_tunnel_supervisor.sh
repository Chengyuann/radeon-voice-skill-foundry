#!/usr/bin/env bash
set -euo pipefail

runtime_dir="${RVSF_RUNTIME_DIR:-/workspace}"
api_port="${RVSF_PUBLIC_API_PORT:-8792}"
rc_tunnel_bin="${RVSF_RC_TUNNEL_BIN:-$HOME/.local/bin/rc-tunnel}"
origin_file="${RVSF_RC_ORIGIN_FILE:-$runtime_dir/rvsf-rc-origin.txt}"
poll_seconds="${RVSF_RC_TUNNEL_POLL_SECONDS:-30}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

install_rc_tunnel() {
  if [[ -x "$rc_tunnel_bin" ]]; then
    return
  fi
  local installer="/var/run/secrets/frp-self-service/install"
  if [[ ! -x "$installer" ]]; then
    log "rc-tunnel installer is unavailable" >&2
    return 1
  fi
  "$installer"
}

read_origin() {
  "$rc_tunnel_bin" status 2>/dev/null |
    sed -nE \
      's#^URL:[[:space:]]+(https://rc-[a-z0-9-]+\.radeon\.firstdg\.ai)$#\1#p' |
    head -1
}

ensure_active() {
  local status=""
  status="$("$rc_tunnel_bin" status 2>&1 || true)"
  if ! grep -q '^FRPC running:[[:space:]]*true$' <<<"$status"; then
    "$rc_tunnel_bin" expose --port "$api_port"
  fi
  local origin=""
  origin="$(read_origin)"
  if [[ -z "$origin" ]]; then
    log "rc-tunnel did not report an origin" >&2
    return 1
  fi
  printf '%s\n' "$origin" >"${origin_file}.tmp"
  mv "${origin_file}.tmp" "$origin_file"
}

install_rc_tunnel
while true; do
  ensure_active || true
  sleep "$poll_seconds"
done
