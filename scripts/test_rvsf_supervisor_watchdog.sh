#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/rvsf-watchdog-test.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT

config_path="$tmp_dir/supervisord.conf"
state_file="$tmp_dir/supervisord.state"
supervisorctl_bin="$tmp_dir/supervisorctl"
supervisord_bin="$tmp_dir/supervisord"
pid_file="$tmp_dir/supervisord.pid"
socket_file="$tmp_dir/supervisor.sock"
start_log="$tmp_dir/supervisord-start.log"
watchdog_pid_file="$tmp_dir/watchdog.pid"
watchdog_log="$tmp_dir/watchdog.log"

printf '[supervisord]\n' >"$config_path"

cat >"$supervisorctl_bin" <<'EOF'
#!/usr/bin/env bash
if [[ -f "${RVSF_TEST_STATE_FILE:?}" ]]; then
  exit 0
fi
exit 1
EOF

cat >"$supervisord_bin" <<'EOF'
#!/usr/bin/env bash
printf 'started\n' >>"${RVSF_TEST_START_LOG:?}"
printf 'running\n' >"${RVSF_TEST_STATE_FILE:?}"
EOF

chmod +x "$supervisorctl_bin" "$supervisord_bin"

run_watchdog() {
  RVSF_SUPERVISOR_CONFIG="$config_path" \
  RVSF_SUPERVISOR_PID_FILE="$pid_file" \
  RVSF_SUPERVISOR_SOCKET_FILE="$socket_file" \
  RVSF_SUPERVISORCTL_BIN="$supervisorctl_bin" \
  RVSF_SUPERVISORD_BIN="$supervisord_bin" \
  RVSF_WATCHDOG_RECOVERY_WAIT_SECONDS=0 \
  RVSF_TEST_STATE_FILE="$state_file" \
  RVSF_TEST_START_LOG="$start_log" \
    bash "$root/scripts/rvsf_supervisor_watchdog.sh" "$@"
}

printf 'running\n' >"$state_file"
run_watchdog check | grep -q 'status=healthy'

rm -f "$state_file"
run_watchdog recover-once | grep -q 'status=recovered'
[[ "$(wc -l <"$start_log" | tr -d ' ')" == "1" ]]

rm -f "$state_file"
printf '%s\n' "$$" >"$pid_file"
if run_watchdog recover-once >/dev/null 2>&1; then
  echo "watchdog started duplicate supervisord despite a live pid" >&2
  exit 1
fi
[[ "$(wc -l <"$start_log" | tr -d ' ')" == "1" ]]

printf 'running\n' >"$state_file"
RVSF_SUPERVISOR_CONFIG="$config_path" \
RVSF_SUPERVISOR_PID_FILE="$pid_file" \
RVSF_SUPERVISOR_SOCKET_FILE="$socket_file" \
RVSF_SUPERVISORCTL_BIN="$supervisorctl_bin" \
RVSF_SUPERVISORD_BIN="$supervisord_bin" \
RVSF_WATCHDOG_PID_FILE="$watchdog_pid_file" \
RVSF_WATCHDOG_LOG_FILE="$watchdog_log" \
RVSF_WATCHDOG_INTERVAL_SECONDS=1 \
RVSF_WATCHDOG_SCRIPT="$root/scripts/rvsf_supervisor_watchdog.sh" \
RVSF_TEST_STATE_FILE="$state_file" \
RVSF_TEST_START_LOG="$start_log" \
  bash "$root/scripts/install_rvsf_supervisor_watchdog.sh" >/dev/null
installed_watchdog_pid="$(cat "$watchdog_pid_file")"
kill -0 "$installed_watchdog_pid"

printf '%s\n' "$$" >"$watchdog_pid_file"
RVSF_SUPERVISOR_CONFIG="$config_path" \
RVSF_SUPERVISOR_PID_FILE="$pid_file" \
RVSF_SUPERVISOR_SOCKET_FILE="$socket_file" \
RVSF_SUPERVISORCTL_BIN="$supervisorctl_bin" \
RVSF_SUPERVISORD_BIN="$supervisord_bin" \
RVSF_WATCHDOG_PID_FILE="$watchdog_pid_file" \
RVSF_WATCHDOG_LOG_FILE="$watchdog_log" \
RVSF_WATCHDOG_INTERVAL_SECONDS=1 \
RVSF_WATCHDOG_SCRIPT="$root/scripts/rvsf_supervisor_watchdog.sh" \
RVSF_TEST_STATE_FILE="$state_file" \
RVSF_TEST_START_LOG="$start_log" \
  bash "$root/scripts/install_rvsf_supervisor_watchdog.sh" >/dev/null
replacement_watchdog_pid="$(cat "$watchdog_pid_file")"
[[ "$replacement_watchdog_pid" != "$$" ]]
kill -0 "$replacement_watchdog_pid"

kill "$installed_watchdog_pid" "$replacement_watchdog_pid" 2>/dev/null || true

echo "supervisor-watchdog-tests=passed"
