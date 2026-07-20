#!/usr/bin/env bash
set -euo pipefail

runtime_dir="${RVSF_RUNTIME_DIR:-/workspace}"
api_port="${RVSF_PUBLIC_API_PORT:-8792}"
cloudflared_bin="${CLOUDFLARED_BIN:-$runtime_dir/cloudflared}"
origin_file="${RVSF_PUBLIC_ORIGIN_FILE:-$runtime_dir/rvsf-public-origin.txt}"

rm -f "$origin_file"

"$cloudflared_bin" tunnel \
  --no-autoupdate \
  --protocol http2 \
  --url "http://127.0.0.1:$api_port" 2>&1 |
  while IFS= read -r line; do
    printf '%s\n' "$line"
    if [[ "$line" =~ (https://[a-z0-9]([a-z0-9-]*[a-z0-9])?\.trycloudflare\.com) ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}" >"${origin_file}.tmp"
      mv "${origin_file}.tmp" "$origin_file"
    fi
  done
