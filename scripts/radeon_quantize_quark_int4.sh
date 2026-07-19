#!/usr/bin/env bash
set -euo pipefail

model_dir="${1:?usage: radeon_quantize_quark_int4.sh MODEL_DIR OUTPUT_DIR}"
output_dir="${2:?usage: radeon_quantize_quark_int4.sh MODEL_DIR OUTPUT_DIR}"
python_bin="${QUARK_PYTHON:-/workspace/.venv-quark/bin/python}"
quark_entry="${QUARK_ENTRY:-/workspace/quark_llm_ptq_entry.py}"
calibration_samples="${QUARK_CALIBRATION_SAMPLES:-32}"
sequence_length="${QUARK_SEQUENCE_LENGTH:-512}"

if [[ ! -x "$python_bin" || ! -f "$quark_entry" ]]; then
  echo "Quark environment is missing under /workspace/.venv-quark" >&2
  exit 1
fi

mkdir -p "$output_dir"

"$python_bin" "$quark_entry" \
  --model_dir "$model_dir" \
  --output_dir "$output_dir" \
  --device cuda \
  --dataset pileval \
  --seq_len "$sequence_length" \
  --batch_size 1 \
  --num_calib_data "$calibration_samples" \
  --quant_scheme int4_wo_128 \
  --skip_evaluation
