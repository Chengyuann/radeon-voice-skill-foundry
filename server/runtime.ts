import type {
  RuntimeDependencyHealth,
  RuntimeInfo
} from "../shared/types.js";

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

export async function getRuntimeDependencyHealth(): Promise<RuntimeDependencyHealth> {
  const modelBaseUrl = process.env.RADEON_OPENAI_BASE_URL?.trim();
  const asrBaseUrl = process.env.RADEON_ASR_BASE_URL?.trim();
  const [model, asr] = await Promise.all([
    checkDependency(modelBaseUrl, true),
    checkDependency(asrBaseUrl, false)
  ]);
  return { model, asr };
}

async function checkDependency(
  baseUrl: string | undefined,
  openAiCompatible: boolean
): Promise<RuntimeDependencyHealth["model"]> {
  if (!baseUrl) return "unconfigured";
  const root = openAiCompatible
    ? baseUrl.replace(/\/v1\/?$/, "")
    : baseUrl.replace(/\/$/, "");
  try {
    const response = await fetch(`${root}/health`, {
      signal: AbortSignal.timeout(3_000)
    });
    if (!response.ok) return "unavailable";
    const payload = (await response.json()) as { ok?: unknown };
    return payload.ok === true ? "healthy" : "unavailable";
  } catch {
    return "unavailable";
  }
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
