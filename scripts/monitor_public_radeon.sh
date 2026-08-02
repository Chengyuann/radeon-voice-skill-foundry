#!/usr/bin/env bash
set -euo pipefail

health_url="${RVSF_PUBLIC_HEALTH_URL:-https://radeon-voice-skill-foundry.pages.dev/api/health}"
interval_seconds="${RVSF_HEALTH_INTERVAL_SECONDS:-60}"
failure_threshold="${RVSF_HEALTH_FAILURE_THRESHOLD:-3}"
log_file="${RVSF_HEALTH_LOG_FILE:-/workspace/rvsf-public-health.log}"
restart_command="${RVSF_HEALTH_RESTART_COMMAND:-supervisorctl -c /workspace/rvsf-supervisord.conf restart rvsf-tunnel rvsf-origin-registrar}"
failures=0

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$log_file"
}

while true; do
  payload="$(
    curl --silent --show-error --fail --max-time 15 "$health_url" 2>/dev/null ||
      true
  )"
  if python3 - "$payload" <<'PY'
import json
import sys

try:
    payload = json.loads(sys.argv[1])
except Exception:
    raise SystemExit(1)
runtime = payload.get("runtime")
if payload.get("ok") is not True or not isinstance(runtime, dict):
    raise SystemExit(1)
if (
    runtime.get("mode") != "radeon"
    or runtime.get("baseUrlConfigured") is not True
    or not runtime.get("gpu")
    or not runtime.get("rocm")
):
    raise SystemExit(1)
PY
  then
    if ((failures > 0)); then
      log "public Radeon health recovered after ${failures} failures"
    fi
    failures=0
  else
    failures=$((failures + 1))
    log "public Radeon health failure ${failures}/${failure_threshold}"
    if ((failures >= failure_threshold)); then
      log "restarting tunnel and origin registrar"
      bash -lc "$restart_command" >>"$log_file" 2>&1 || true
      failures=0
    fi
  fi
  sleep "$interval_seconds"
done
