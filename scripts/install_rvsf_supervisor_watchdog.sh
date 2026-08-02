#!/usr/bin/env bash
set -euo pipefail

watchdog_script="${RVSF_WATCHDOG_SCRIPT:-/workspace/radeon-voice-skill-foundry-current/scripts/rvsf_supervisor_watchdog.sh}"
pid_file="${RVSF_WATCHDOG_PID_FILE:-/workspace/rvsf-supervisor-watchdog.pid}"
log_file="${RVSF_WATCHDOG_LOG_FILE:-/workspace/rvsf-supervisor-watchdog.log}"

if [[ ! -x "$watchdog_script" ]]; then
  echo "watchdog script is not executable: $watchdog_script" >&2
  exit 1
fi

if [[ -f "$pid_file" ]]; then
  existing_pid="$(tr -cd '0-9' <"$pid_file")"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "watchdog already running: pid=$existing_pid"
    "$watchdog_script" check
    exit 0
  fi
  rm -f "$pid_file"
fi

mkdir -p "$(dirname "$log_file")"
nohup "$watchdog_script" watch >>"$log_file" 2>&1 </dev/null &
watchdog_pid=$!

for _ in 1 2 3 4 5; do
  if kill -0 "$watchdog_pid" 2>/dev/null && [[ -f "$pid_file" ]]; then
    echo "watchdog started: pid=$watchdog_pid"
    "$watchdog_script" check
    exit 0
  fi
  sleep 1
done

echo "watchdog failed to start; inspect $log_file" >&2
exit 1
