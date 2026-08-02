#!/usr/bin/env bash
set -euo pipefail

health_url="${RVSF_PUBLIC_HEALTH_URL:-https://radeon-voice-skill-foundry.pages.dev/api/health}"
log_dir="${RVSF_LOCAL_MONITOR_LOG_DIR:-$HOME/Library/Logs/rvsf-public-monitor}"
mkdir -p "$log_dir"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

status="$(
  curl --silent --show-error \
    --output "$body_file" \
    --write-out '%{http_code}' \
    --max-time 20 \
    "$health_url" ||
    true
)"

if [[ "$status" == "200" ]] && python3 - "$body_file" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    payload = json.load(source)
dependencies = payload.get("dependencies") or {}
if (
    payload.get("ok") is not True
    or payload.get("healthy") is not True
    or dependencies.get("model") != "healthy"
    or dependencies.get("asr") != "healthy"
):
    raise SystemExit(1)
PY
then
  printf '%s status=healthy http=%s\n' "$timestamp" "$status" \
    >>"$log_dir/health.log"
  exit 0
fi

summary="$(
  python3 - "$body_file" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as source:
        payload = json.load(source)
except Exception:
    print("non-json response")
else:
    print(
        json.dumps(
            {
                "ok": payload.get("ok"),
                "healthy": payload.get("healthy"),
                "dependencies": payload.get("dependencies"),
                "runtime": payload.get("runtime"),
            },
            separators=(",", ":"),
        )
    )
PY
)"
printf '%s status=unhealthy http=%s %s\n' "$timestamp" "$status" "$summary" \
  | tee -a "$log_dir/health.log" >&2
exit 1
