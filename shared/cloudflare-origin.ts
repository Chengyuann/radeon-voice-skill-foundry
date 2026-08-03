export const RADEON_ORIGIN_REGISTRY_KEY = "radeon-api-origin";
export type RadeonOriginRole = "primary" | "fallback";

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

type RecoveryRuntimeProof = {
  mode: "radeon";
  model: string;
  baseUrlConfigured: true;
  gpu: string;
  rocm: string;
};

export async function resolveRadeonOrigin(
  env: RadeonOriginEnv
): Promise<string | undefined> {
  return (await resolveRadeonOrigins(env))[0];
}

export async function resolveRadeonOrigins(
  env: RadeonOriginEnv
): Promise<string[]> {
  let registered: string | null | undefined;
  try {
    registered = await env.RVSF_ORIGIN_REGISTRY?.get(
      RADEON_ORIGIN_REGISTRY_KEY
    );
  } catch {
    registered = undefined;
  }
  const parsed = parseOriginRegistry(registered);
  return uniqueOrigins([
    parsed.primary,
    parsed.fallback,
    normalizeRadeonOrigin(env.RADEON_API_ORIGIN)
  ]);
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
      !isAllowedRadeonOriginHost(url.hostname)
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

export function parseOriginRegistry(
  candidate: string | null | undefined
): { primary?: string; fallback?: string } {
  const legacy = normalizeRadeonOrigin(candidate);
  if (legacy) return { primary: legacy };
  if (!candidate) return {};
  try {
    const parsed = JSON.parse(candidate) as {
      primary?: unknown;
      fallback?: unknown;
    };
    return {
      primary:
        typeof parsed.primary === "string"
          ? normalizeRadeonOrigin(parsed.primary)
          : undefined,
      fallback:
        typeof parsed.fallback === "string"
          ? normalizeRadeonOrigin(parsed.fallback)
          : undefined
    };
  } catch {
    return {};
  }
}

export async function handleOriginRecovery(
  request: Request,
  env: RadeonOriginEnv
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
      {
        error:
          "Origin must be an HTTPS rc-*.radeon.firstdg.ai or trycloudflare.com origin"
      },
      { status: 400 }
    );
  }
  const role = parseOriginRole(body);

  const timestamp =
    body &&
    typeof body === "object" &&
    "timestamp" in body &&
    typeof body.timestamp === "number" &&
    Number.isInteger(body.timestamp)
      ? body.timestamp
      : undefined;
  const runtime = parseRuntimeProof(body);
  const signature =
    body &&
    typeof body === "object" &&
    "signature" in body &&
    typeof body.signature === "string"
      ? body.signature
      : undefined;
  if (
    timestamp === undefined ||
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 180 ||
    !runtime ||
    !signature ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return Response.json(
      { error: "Invalid or expired Radeon health proof" },
      { status: 400 }
    );
  }

  const proof = { origin, role, timestamp, runtime };
  const legacyProof = { origin, timestamp, runtime };
  if (
    !(await verifyHealthProof(proof, signature, apiToken)) &&
    !(await verifyHealthProof(legacyProof, signature, apiToken))
  ) {
    return Response.json(
      { error: "Radeon health proof signature is invalid" },
      { status: 401 }
    );
  }

  let existing: string | null = null;
  try {
    existing = await env.RVSF_ORIGIN_REGISTRY.get(
      RADEON_ORIGIN_REGISTRY_KEY
    );
  } catch {
    existing = null;
  }
  const registry = parseOriginRegistry(existing);
  registry[role] = origin;
  await env.RVSF_ORIGIN_REGISTRY.put(
    RADEON_ORIGIN_REGISTRY_KEY,
    JSON.stringify(registry)
  );
  return Response.json({
    ok: true,
    origin,
    role,
    origins: registry,
    registeredAt: new Date().toISOString(),
    runtime
  });
}

function parseOriginRole(body: unknown): RadeonOriginRole {
  if (
    body &&
    typeof body === "object" &&
    "role" in body &&
    body.role === "fallback"
  ) {
    return "fallback";
  }
  return "primary";
}

function isAllowedRadeonOriginHost(hostname: string): boolean {
  return (
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/i.test(
      hostname
    ) ||
    /^rc-[a-z0-9-]+\.radeon\.firstdg\.ai$/i.test(hostname)
  );
}

function uniqueOrigins(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

function parseRuntimeProof(body: unknown): RecoveryRuntimeProof | undefined {
  if (
    !body ||
    typeof body !== "object" ||
    !("runtime" in body) ||
    !body.runtime ||
    typeof body.runtime !== "object"
  ) {
    return undefined;
  }
  const runtime = body.runtime;
  if (
    !("mode" in runtime) ||
    runtime.mode !== "radeon" ||
    !("baseUrlConfigured" in runtime) ||
    runtime.baseUrlConfigured !== true ||
    !("model" in runtime) ||
    typeof runtime.model !== "string" ||
    !runtime.model.trim() ||
    !("gpu" in runtime) ||
    typeof runtime.gpu !== "string" ||
    !runtime.gpu.trim() ||
    !("rocm" in runtime) ||
    typeof runtime.rocm !== "string" ||
    !runtime.rocm.trim()
  ) {
    return undefined;
  }
  return {
    mode: "radeon",
    model: runtime.model,
    baseUrlConfigured: true,
    gpu: runtime.gpu,
    rocm: runtime.rocm
  };
}

async function verifyHealthProof(
  proof: {
    origin: string;
    role?: RadeonOriginRole;
    timestamp: number;
    runtime: RecoveryRuntimeProof;
  },
  signature: string,
  apiToken: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(signature),
    encoder.encode(JSON.stringify(proof))
  );
}

function hexToBytes(value: string): ArrayBuffer {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
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
