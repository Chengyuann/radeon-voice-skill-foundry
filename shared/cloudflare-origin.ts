export const RADEON_ORIGIN_REGISTRY_KEY = "radeon-api-origin";

export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

export type RadeonOriginEnv = {
  RADEON_API_ORIGIN?: string;
  RVSF_API_TOKEN?: string;
  RVSF_ORIGIN_RECOVERY_TOKEN?: string;
  RVSF_ORIGIN_REGISTRY?: KeyValueStore;
};

type Fetcher = typeof fetch;

type HealthPayload = {
  ok?: unknown;
  runtime?: {
    mode?: unknown;
    model?: unknown;
    baseUrlConfigured?: unknown;
    gpu?: unknown;
    rocm?: unknown;
  };
};

export async function resolveRadeonOrigin(
  env: RadeonOriginEnv
): Promise<string | undefined> {
  let registered: string | null | undefined;
  try {
    registered = await env.RVSF_ORIGIN_REGISTRY?.get(
      RADEON_ORIGIN_REGISTRY_KEY
    );
  } catch {
    registered = undefined;
  }
  return normalizeRadeonOrigin(registered) ??
    normalizeRadeonOrigin(env.RADEON_API_ORIGIN);
}

export function normalizeRadeonOrigin(
  candidate: string | null | undefined
): string | undefined {
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/i.test(
        url.hostname
      )
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

export async function handleOriginRecovery(
  request: Request,
  env: RadeonOriginEnv,
  fetcher: Fetcher = fetch
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: { allow: "POST" } }
    );
  }

  const recoveryToken = env.RVSF_ORIGIN_RECOVERY_TOKEN?.trim();
  const apiToken = env.RVSF_API_TOKEN?.trim();
  if (!recoveryToken || !apiToken || !env.RVSF_ORIGIN_REGISTRY) {
    return Response.json(
      { error: "Origin recovery is not configured" },
      { status: 503 }
    );
  }

  const providedToken =
    request.headers.get("x-rvsf-origin-recovery-token") || "";
  if (!(await secretsMatch(providedToken, recoveryToken))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const candidate =
    body &&
    typeof body === "object" &&
    "origin" in body &&
    typeof body.origin === "string"
      ? body.origin
      : undefined;
  const origin = normalizeRadeonOrigin(candidate);
  if (!origin) {
    return Response.json(
      { error: "Origin must be an HTTPS trycloudflare.com origin" },
      { status: 400 }
    );
  }

  const health = await validateRadeonHealth(origin, apiToken, fetcher);
  if (!health.ok) {
    return Response.json({ error: health.error }, { status: 502 });
  }

  await env.RVSF_ORIGIN_REGISTRY.put(
    RADEON_ORIGIN_REGISTRY_KEY,
    origin
  );
  return Response.json({
    ok: true,
    origin,
    registeredAt: new Date().toISOString(),
    runtime: health.runtime
  });
}

async function validateRadeonHealth(
  origin: string,
  apiToken: string,
  fetcher: Fetcher
): Promise<
  | { ok: true; runtime: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(`${origin}/api/health`, {
      headers: {
        "x-rvsf-api-token": apiToken
      },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Candidate origin health check returned ${response.status}`
      };
    }
    const payload = (await response.json()) as HealthPayload;
    const runtime = payload.runtime;
    if (
      payload.ok !== true ||
      !runtime ||
      runtime.mode !== "radeon" ||
      runtime.baseUrlConfigured !== true ||
      typeof runtime.model !== "string" ||
      typeof runtime.gpu !== "string" ||
      typeof runtime.rocm !== "string"
    ) {
      return {
        ok: false,
        error: "Candidate origin is not a healthy Radeon runtime"
      };
    }
    return { ok: true, runtime: runtime as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      error: "Candidate origin health check failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function secretsMatch(
  provided: string,
  expected: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}
