#!/usr/bin/env bash
set -euo pipefail

export RVSF_PUBLIC_ORIGIN_FILE="${RVSF_RC_ORIGIN_FILE:-/workspace/rvsf-rc-origin.txt}"
export RVSF_ORIGIN_ROLE="primary"
export RVSF_REGISTERED_ORIGIN_FILE="${RVSF_RC_REGISTERED_ORIGIN_FILE:-/workspace/rvsf-primary-registered-origin.txt}"
export RVSF_ORIGIN_RESPONSE_FILE="${RVSF_RC_ORIGIN_RESPONSE_FILE:-/workspace/rvsf-primary-origin-registration-response.json}"

exec /bin/bash \
  /workspace/radeon-voice-skill-foundry-current/scripts/radeon_origin_registrar.sh \
  "${1:-watch}"
