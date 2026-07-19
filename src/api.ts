import type {
  CompileRequest,
  CompileResult,
  DemonstrationSession,
  KnowledgeDocument,
  KnowledgeMatch,
  RuntimeInfo,
  SkillReuseResult,
  SkillRevalidationResult,
  StoredSkill,
  TranscribeResult,
  VerifyResult
} from "../shared/types";
import type { DemonstrationCommandType } from "../shared/demonstration";

function apiUrl(path: string): string {
  const proxyPrefix =
    window.location.pathname.match(
      /^(\/instances\/[^/]+\/proxy\/\d+)/
    )?.[1] || "";
  return `${proxyPrefix}${path}`;
}

async function requestJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with ${response.status}`;
    throw new Error(
      message
    );
  }
  return payload as T;
}

export function getRuntime(): Promise<RuntimeInfo> {
  return requestJson<{
    ok: boolean;
    runtime: RuntimeInfo;
    persisted: NonNullable<RuntimeInfo["persisted"]>;
  }>(apiUrl("/api/health")).then((result) => ({
    ...result.runtime,
    persisted: result.persisted
  }));
}

export function compileSop(input: CompileRequest): Promise<CompileResult> {
  return requestJson(apiUrl("/api/compile"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function createDemonstration(): Promise<DemonstrationSession> {
  return requestJson(apiUrl("/api/demonstrations"), {
    method: "POST"
  });
}

export function runDemonstrationCommand(
  sessionId: string,
  type: DemonstrationCommandType
): Promise<DemonstrationSession> {
  return requestJson(
    apiUrl(`/api/demonstrations/${sessionId}/commands`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    }
  );
}

export function verifySop(
  compilation: CompileResult,
  actions: CompileRequest["actions"]
): Promise<VerifyResult> {
  return requestJson(apiUrl("/api/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ compilation, actions })
  });
}

export function listKnowledge(): Promise<KnowledgeDocument[]> {
  return requestJson(apiUrl("/api/knowledge"));
}

export function addKnowledge(input: {
  title: string;
  content: string;
}): Promise<KnowledgeDocument> {
  return requestJson(apiUrl("/api/knowledge"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function searchKnowledge(
  query: string,
  limit = 4
): Promise<KnowledgeMatch[]> {
  return requestJson(apiUrl("/api/knowledge/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit })
  });
}

export function refineSop(input: {
  compilation: CompileResult;
  message: string;
  actions: CompileRequest["actions"];
  useModel?: boolean;
}): Promise<CompileResult> {
  return requestJson(apiUrl("/api/refine"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export function listSkills(): Promise<StoredSkill[]> {
  return requestJson(apiUrl("/api/skills"));
}

export function saveSkill(runId: string): Promise<StoredSkill> {
  return requestJson(apiUrl(`/api/skills/${runId}`), {
    method: "POST"
  });
}

export async function reuseSkill(skillId: string): Promise<SkillReuseResult> {
  const startedAt = performance.now();
  const result = await requestJson<SkillReuseResult>(
    apiUrl(`/api/skills/${skillId}/reuse`),
    {
      method: "POST"
    }
  );
  const httpRoundTripMs = Math.max(
    0.01,
    Math.round((performance.now() - startedAt) * 100) / 100
  );
  return {
    ...result,
    httpRoundTripMs,
    httpSpeedup:
      Math.round(
        (result.originalCompileDurationMs / httpRoundTripMs) * 10
      ) / 10
  };
}

export function revalidateSkill(
  skillId: string
): Promise<SkillRevalidationResult> {
  return requestJson(apiUrl(`/api/skills/${skillId}/revalidate`), {
    method: "POST"
  });
}

export async function transcribeAudio(file: Blob): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("audio", file, file instanceof File ? file.name : "recording.webm");
  const response = await fetch(apiUrl("/api/transcribe"), {
    method: "POST",
    body: form
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Transcription failed with ${response.status}`;
    throw new Error(message);
  }
  return payload as TranscribeResult;
}
