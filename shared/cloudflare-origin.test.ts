import { describe, expect, it, vi } from "vitest";
import {
  handleOriginRecovery,
  normalizeRadeonOrigin,
  parseOriginRegistry,
  RADEON_ORIGIN_FALLBACK_KEY,
  RADEON_ORIGIN_PRIMARY_KEY,
  RADEON_ORIGIN_REGISTRY_KEY,
  resolveRadeonOrigin,
  resolveRadeonOrigins,
  type KeyValueStore
} from "./cloudflare-origin.js";
import { proxyRadeonRequest } from "../functions/api/[[path]].js";

describe("Cloudflare Radeon origin recovery", () => {
  it("prefers a valid registered origin and falls back to the configured origin", async () => {
    const registry = memoryRegistry(
      "https://current-tunnel.trycloudflare.com"
    );
    await expect(
      resolveRadeonOrigin({
        RVSF_ORIGIN_REGISTRY: registry,
        RADEON_API_ORIGIN: "https://fallback-tunnel.trycloudflare.com"
      })
    ).resolves.toBe("https://current-tunnel.trycloudflare.com");

    await registry.put(RADEON_ORIGIN_REGISTRY_KEY, "not-an-origin");
    await expect(
      resolveRadeonOrigin({
        RVSF_ORIGIN_REGISTRY: registry,
        RADEON_API_ORIGIN: "https://fallback-tunnel.trycloudflare.com"
      })
    ).resolves.toBe("https://fallback-tunnel.trycloudflare.com");

    const dualRegistry = memoryRegistry(
      undefined,
      {
        [RADEON_ORIGIN_PRIMARY_KEY]:
          "https://rc-0123456789abcdef.radeon.firstdg.ai",
        [RADEON_ORIGIN_FALLBACK_KEY]:
          "https://fallback-tunnel.trycloudflare.com"
      }
    );
    await expect(
      resolveRadeonOrigins({
        RVSF_ORIGIN_REGISTRY: dualRegistry,
        RADEON_API_ORIGIN: "https://configured-tunnel.trycloudflare.com"
      })
    ).resolves.toEqual([
      "https://rc-0123456789abcdef.radeon.firstdg.ai",
      "https://fallback-tunnel.trycloudflare.com",
      "https://configured-tunnel.trycloudflare.com"
    ]);

    const healthFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("origin down", { status: 530 }))
      .mockResolvedValueOnce(Response.json({ ok: true, healthy: true }));
    const healthResponse = await proxyRadeonRequest(
      new Request("https://public.example/api/health"),
      proxyEnv(dualRegistry),
      healthFetch
    );
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers.get("x-rvsf-origin-kind")).toBe(
      "quick-tunnel"
    );
    expect(healthFetch).toHaveBeenCalledTimes(2);
    expect(requestUrl(healthFetch.mock.calls[0][0])).toBe(
      "https://rc-0123456789abcdef.radeon.firstdg.ai/api/health"
    );
    expect(requestUrl(healthFetch.mock.calls[1][0])).toBe(
      "https://fallback-tunnel.trycloudflare.com/api/health"
    );
  });

  it("accepts only canonical HTTPS Quick Tunnel origins", () => {
    expect(
      normalizeRadeonOrigin("https://valid-name.trycloudflare.com/")
    ).toBe("https://valid-name.trycloudflare.com");
    expect(
      normalizeRadeonOrigin("http://valid-name.trycloudflare.com")
    ).toBeUndefined();
    expect(
      normalizeRadeonOrigin(
        "https://valid-name.trycloudflare.com/api/health"
      )
    ).toBeUndefined();
    expect(
      normalizeRadeonOrigin("https://trycloudflare.com.attacker.example")
    ).toBeUndefined();
    expect(
      normalizeRadeonOrigin("https://rc-0123456789abcdef.radeon.firstdg.ai/")
    ).toBe("https://rc-0123456789abcdef.radeon.firstdg.ai");
    expect(
      normalizeRadeonOrigin("https://evil-radeon.firstdg.ai")
    ).toBeUndefined();

    expect(
      parseOriginRegistry("https://legacy.trycloudflare.com")
    ).toEqual({
      primary: "https://legacy.trycloudflare.com"
    });
    expect(
      parseOriginRegistry(
        JSON.stringify({
          primary: "https://rc-0123456789abcdef.radeon.firstdg.ai",
          fallback: "https://fallback.trycloudflare.com"
        })
      )
    ).toEqual({
      primary: "https://rc-0123456789abcdef.radeon.firstdg.ai",
      fallback: "https://fallback.trycloudflare.com"
    });
  });

  it("uses the fallback origin when the registry is temporarily unavailable", async () => {
    await expect(
      resolveRadeonOrigin({
        RVSF_ORIGIN_REGISTRY: {
          async get() {
            throw new Error("KV unavailable");
          },
          async put() {
            throw new Error("not used");
          }
        },
        RADEON_API_ORIGIN: "https://fallback-tunnel.trycloudflare.com"
      })
    ).resolves.toBe("https://fallback-tunnel.trycloudflare.com");
  });

  it("rejects unauthorized registration without probing the candidate", async () => {
    const registry = memoryRegistry();
    const unauthorizedResponse = await handleOriginRecovery(
      await recoveryRequest("wrong-token"),
      recoveryEnv(registry)
    );

    expect(unauthorizedResponse.status).toBe(401);
    expect(await registry.get(RADEON_ORIGIN_REGISTRY_KEY)).toBeNull();
  });

  it("writes a new origin only after a fresh signed Radeon health proof", async () => {
    const registry = memoryRegistry();
    const response = await handleOriginRecovery(
      await recoveryRequest("recovery-token"),
      recoveryEnv(registry)
    );

    expect(response.status).toBe(200);
    expect(await registry.get(RADEON_ORIGIN_REGISTRY_KEY)).toBe(
      null
    );
    expect(await registry.get(RADEON_ORIGIN_PRIMARY_KEY)).toBe(
      "https://new-tunnel.trycloudflare.com"
    );

    const dualRegistry = memoryRegistry(
      undefined,
      {
        [RADEON_ORIGIN_PRIMARY_KEY]:
          "https://rc-0123456789abcdef.radeon.firstdg.ai"
      }
    );
    const fallbackResponse = await handleOriginRecovery(
      await recoveryRequest("recovery-token", validRuntime(), undefined, {
        origin: "https://fallback-tunnel.trycloudflare.com",
        role: "fallback"
      }),
      recoveryEnv(dualRegistry)
    );

    expect(fallbackResponse.status).toBe(200);
    expect(
      await dualRegistry.get(RADEON_ORIGIN_PRIMARY_KEY)
    ).toBe("https://rc-0123456789abcdef.radeon.firstdg.ai");
    expect(await dualRegistry.get(RADEON_ORIGIN_FALLBACK_KEY)).toBe(
      "https://fallback-tunnel.trycloudflare.com"
    );

    const verifyFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ status: "verified" }));
    const verifyResponse = await proxyRadeonRequest(
      new Request("https://public.example/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ compilation: { runId: "run_1" }, actions: [] })
      }),
      proxyEnv(dualRegistry),
      verifyFetch
    );
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.headers.get("x-rvsf-origin-kind")).toBe(
      "quick-tunnel"
    );
    expect(verifyFetch).toHaveBeenCalledTimes(2);

    const compileFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 530 }))
      .mockResolvedValueOnce(Response.json({ ok: true, healthy: true }))
      .mockResolvedValueOnce(Response.json({ runId: "run_1" }));
    const compileResponse = await proxyRadeonRequest(
      new Request("https://public.example/api/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectName: "demo" })
      }),
      proxyEnv(dualRegistry),
      compileFetch
    );
    expect(compileResponse.status).toBe(200);
    expect(compileFetch).toHaveBeenCalledTimes(3);
    expect(requestUrl(compileFetch.mock.calls[2][0])).toBe(
      "https://fallback-tunnel.trycloudflare.com/api/compile"
    );
  });

  it("does not register a non-Radeon health proof", async () => {
    const registry = memoryRegistry();
    const response = await handleOriginRecovery(
      await recoveryRequest("recovery-token", {
        mode: "deterministic",
        model: "fixture",
        baseUrlConfigured: false,
        gpu: "none",
        rocm: "none"
      }),
      recoveryEnv(registry)
    );

    expect(response.status).toBe(400);
    expect(await registry.get(RADEON_ORIGIN_REGISTRY_KEY)).toBeNull();
  });

  it("rejects a stale or incorrectly signed health proof", async () => {
    const registry = memoryRegistry();
    const stale = Math.floor(Date.now() / 1000) - 181;
    const staleResponse = await handleOriginRecovery(
      await recoveryRequest("recovery-token", validRuntime(), stale),
      recoveryEnv(registry)
    );
    expect(staleResponse.status).toBe(400);

    const request = await recoveryRequest("recovery-token");
    const body = await request.json();
    body.signature = "0".repeat(64);
    const invalidResponse = await handleOriginRecovery(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(body)
      }),
      recoveryEnv(registry)
    );
    expect(invalidResponse.status).toBe(401);
    expect(await registry.get(RADEON_ORIGIN_REGISTRY_KEY)).toBeNull();
  });
});

async function recoveryRequest(
  token: string,
  runtime: Record<string, unknown> = validRuntime(),
  timestamp = Math.floor(Date.now() / 1000),
  overrides: { origin?: string; role?: "primary" | "fallback" } = {}
): Promise<Request> {
  const proof = {
    origin: overrides.origin || "https://new-tunnel.trycloudflare.com",
    role: overrides.role || "primary",
    timestamp,
    runtime
  };
  const signature = await signProof(proof, "api-token");
  return new Request(
    "https://radeon-voice-skill-foundry.pages.dev/internal/origin-recovery",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rvsf-origin-recovery-token": token
      },
      body: JSON.stringify({
        ...proof,
        signature
      })
    }
  );
}

function validRuntime() {
  return {
    mode: "radeon",
    model: "Qwen/Qwen3-4B-Instruct-2507",
    baseUrlConfigured: true,
    gpu: "AMD Radeon Pro W7900-class gfx1100 48GB",
    rocm: "ROCm 7.2.1"
  };
}

async function signProof(
  proof: Record<string, unknown>,
  token: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(token),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(JSON.stringify(proof))
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function recoveryEnv(registry: KeyValueStore) {
  return {
    RVSF_API_TOKEN: "api-token",
    RVSF_ORIGIN_RECOVERY_TOKEN: "recovery-token",
    RVSF_ORIGIN_REGISTRY: registry
  };
}

function memoryRegistry(
  initial?: string,
  entries: Record<string, string> = {}
): KeyValueStore {
  const values = new Map<string, string>();
  if (initial) values.set(RADEON_ORIGIN_REGISTRY_KEY, initial);
  for (const [key, value] of Object.entries(entries)) {
    values.set(key, value);
  }
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      values.set(key, value);
    }
  };
}

function proxyEnv(registry: KeyValueStore) {
  return {
    RVSF_API_TOKEN: "api-token",
    RVSF_ORIGIN_REGISTRY: registry
  };
}

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : String(input);
}
