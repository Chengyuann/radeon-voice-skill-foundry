import type { RuntimeInfo } from "../shared/types.js";

export function getRuntimeInfo(): RuntimeInfo {
  const baseUrl = process.env.RADEON_OPENAI_BASE_URL?.trim();
  const asrRtf = parseOptionalNumber(process.env.RADEON_ASR_RTF);
  const asrXRealtime = parseOptionalNumber(
    process.env.RADEON_ASR_X_REALTIME
  );
  const asrPeakVramGiB = parseOptionalNumber(
    process.env.RADEON_ASR_PEAK_VRAM_GIB
  );
  return {
    mode: baseUrl ? "radeon" : "deterministic",
    model: process.env.RADEON_MODEL || "Qwen3 local adapter pending",
    baseUrlConfigured: Boolean(baseUrl),
    asrModel: process.env.RADEON_ASR_MODEL || "Qwen3-ASR-0.6B planned",
    gpu: process.env.RADEON_GPU_NAME || "Awaiting Radeon Cloud allocation",
    rocm: process.env.ROCM_VERSION || "Awaiting Radeon Cloud allocation",
    ...(asrRtf !== undefined ? { asrRtf } : {}),
    ...(asrXRealtime !== undefined ? { asrXRealtime } : {}),
    ...(asrPeakVramGiB !== undefined ? { asrPeakVramGiB } : {})
  };
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
