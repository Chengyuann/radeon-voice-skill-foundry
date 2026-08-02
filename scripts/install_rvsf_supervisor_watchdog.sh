#!/usr/bin/env bash
set -euo pipefail

watchdog_script="${RVSF_WATCHDOG_SCRIPT:-/workspace/radeon-voice-skill-foundry-current/scripts/rvsf_supervisor_watchdog.sh}"
pid_file="${RVSF_WATCHDOG_PID_FILE:-/workspace/rvsf-supervisor-watchdog.pid}"
log_file="${RVSF_WATCHDOG_LOG_FILE:-/workspace/rvsf-supervisor-watchdog.log}"

is_watchdog_process() {
  local pid="$1"
  local command_line=""
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi
  if [[ -r "/proc/$pid/cmdline" ]]; then
    command_line="$(tr '\0' ' ' <"/proc/$pid/cmdline")"
  else
    command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  fi
  [[ "$command_line" == *"rvsf_supervisor_watchdog.sh watch"* ]]
}

if [[ ! -x "$watchdog_script" ]]; then
  echo "watchdog script is not executable: $watchdog_script" >&2
  exit 1
fi

if [[ -f "$pid_file" ]]; then
  existing_pid="$(tr -cd '0-9' <"$pid_file")"
  if is_watchdog_process "$existing_pid"; then
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
