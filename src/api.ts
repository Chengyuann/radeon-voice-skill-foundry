import type {
  CompileRequest,
  CompileResult,
  RuntimeInfo,
  VerifyResult
} from "../shared/types";

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
  return requestJson(apiUrl("/api/runtime"));
}

export function compileSop(input: CompileRequest): Promise<CompileResult> {
  return requestJson(apiUrl("/api/compile"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
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
