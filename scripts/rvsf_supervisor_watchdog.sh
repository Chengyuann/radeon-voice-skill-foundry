#!/usr/bin/env bash
set -euo pipefail

config_path="${RVSF_SUPERVISOR_CONFIG:-/workspace/rvsf-supervisord.conf}"
pid_file="${RVSF_SUPERVISOR_PID_FILE:-/workspace/rvsf-supervisord.pid}"
socket_file="${RVSF_SUPERVISOR_SOCKET_FILE:-/workspace/rvsf-supervisor.sock}"
watchdog_pid_file="${RVSF_WATCHDOG_PID_FILE:-/workspace/rvsf-supervisor-watchdog.pid}"
interval_seconds="${RVSF_WATCHDOG_INTERVAL_SECONDS:-30}"
failure_threshold="${RVSF_WATCHDOG_FAILURE_THRESHOLD:-3}"
recovery_wait_seconds="${RVSF_WATCHDOG_RECOVERY_WAIT_SECONDS:-15}"
supervisorctl_bin="${RVSF_SUPERVISORCTL_BIN:-$(command -v supervisorctl || true)}"
supervisord_bin="${RVSF_SUPERVISORD_BIN:-$(command -v supervisord || true)}"
mode="${1:-watch}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

require_runtime() {
  if [[ ! -f "$config_path" ]]; then
    log "status=error reason=missing_config path=$config_path" >&2
    return 1
  fi
  if [[ -z "$supervisorctl_bin" || ! -x "$supervisorctl_bin" ]]; then
    log "status=error reason=missing_supervisorctl" >&2
    return 1
  fi
  if [[ -z "$supervisord_bin" || ! -x "$supervisord_bin" ]]; then
    log "status=error reason=missing_supervisord" >&2
    return 1
  fi
}

supervisor_healthy() {
  "$supervisorctl_bin" -c "$config_path" pid >/dev/null 2>&1
}

remove_stale_runtime_files() {
  local supervisor_pid=""
  if [[ -f "$pid_file" ]]; then
    supervisor_pid="$(tr -cd '0-9' <"$pid_file")"
  fi
  if [[ -n "$supervisor_pid" ]] && kill -0 "$supervisor_pid" 2>/dev/null; then
    log "status=blocked reason=live_supervisord_unreachable pid=$supervisor_pid" >&2
    return 1
  fi
  rm -f "$pid_file" "$socket_file"
}

recover_supervisor() {
  if supervisor_healthy; then
    return 0
  fi
  remove_stale_runtime_files || return 1
  log "status=recovering action=start_supervisord"
  "$supervisord_bin" -c "$config_path"
  sleep "$recovery_wait_seconds"
  if ! supervisor_healthy; then
    log "status=error reason=supervisord_recovery_failed" >&2
    return 1
  fi
  log "status=recovered action=start_supervisord"
}

write_watchdog_pid() {
  mkdir -p "$(dirname "$watchdog_pid_file")"
  printf '%s\n' "$$" >"$watchdog_pid_file"
}

cleanup() {
  if [[ -f "$watchdog_pid_file" ]] &&
    [[ "$(cat "$watchdog_pid_file" 2>/dev/null || true)" == "$$" ]]; then
    rm -f "$watchdog_pid_file"
  fi
}

require_runtime

case "$mode" in
  check)
    if supervisor_healthy; then
      log "status=healthy"
      exit 0
    fi
    log "status=unhealthy" >&2
    exit 1
    ;;
  recover-once)
    recover_supervisor
    ;;
  watch)
    write_watchdog_pid
    trap cleanup EXIT INT TERM
    failures=0
    was_unhealthy=0
    while true; do
      if supervisor_healthy; then
        if ((was_unhealthy == 1)); then
          log "status=healthy recovered_after_failures=$failures"
        fi
        failures=0
        was_unhealthy=0
      else
        failures=$((failures + 1))
        was_unhealthy=1
        log "status=unhealthy failure=$failures threshold=$failure_threshold" >&2
        if ((failures >= failure_threshold)); then
          recover_supervisor || true
          failures=0
        fi
      fi
      sleep "$interval_seconds"
    done
    ;;
  *)
    echo "usage: $0 {check|recover-once|watch}" >&2
    exit 2
    ;;
esac
