#!/usr/bin/env bash
set -euo pipefail

origin="${1:-}"
project="${RVSF_PAGES_PROJECT:-radeon-voice-skill-foundry}"

if [[ ! "$origin" =~ ^https://[-a-z0-9.]+$ ]]; then
  echo "usage: $0 https://<radeon-origin-host>" >&2
  exit 2
fi

printf '%s' "$origin" |
  npx wrangler pages secret put RADEON_API_ORIGIN --project-name "$project"
npm run build
npx wrangler pages deploy dist \
  --project-name "$project" \
  --branch main \
  --commit-hash "$(git rev-parse HEAD)" \
  --commit-message "$(git log -1 --pretty=%s)"
