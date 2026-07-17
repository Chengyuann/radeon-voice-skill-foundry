#!/usr/bin/env bash
set -euo pipefail

echo "== System =="
uname -a || true

echo
echo "== ROCm =="
if command -v rocminfo >/dev/null 2>&1; then
  rocminfo | sed -n '1,80p'
else
  echo "rocminfo not found"
fi

echo
echo "== GPU inventory =="
if command -v rocm-smi >/dev/null 2>&1; then
  rocm-smi || true
else
  echo "rocm-smi not found"
fi

echo
echo "== Python/PyTorch =="
python3 - <<'PY'
import sys
print("python", sys.version)
try:
    import torch
    print("torch", torch.__version__)
    print("cuda_available", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("device_count", torch.cuda.device_count())
        print("device_0", torch.cuda.get_device_name(0))
except Exception as exc:
    print("torch_check_error", repr(exc))
PY

echo
echo "== Node app =="
node --version
npm --version
npm test

echo
echo "== Optional OpenAI-compatible endpoint =="
if [[ -n "${RADEON_OPENAI_BASE_URL:-}" && -n "${RADEON_MODEL:-}" ]]; then
  curl -sS "${RADEON_OPENAI_BASE_URL%/}/chat/completions" \
    -H "Content-Type: application/json" \
    ${RADEON_API_KEY:+-H "Authorization: Bearer ${RADEON_API_KEY}"} \
    -d "{\"model\":\"${RADEON_MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"Return exactly: radeon-ok\"}],\"temperature\":0}" \
    | sed -n '1,40p'
else
  echo "Set RADEON_OPENAI_BASE_URL and RADEON_MODEL to test model API."
fi

