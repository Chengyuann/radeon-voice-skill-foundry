import { describe, expect, it } from "vitest";
import {
  handleOriginRecovery,
  normalizeRadeonOrigin,
  RADEON_ORIGIN_REGISTRY_KEY,
  resolveRadeonOrigin,
  type KeyValueStore
} from "./cloudflare-origin.js";

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
    const response = await handleOriginRecovery(
      await recoveryRequest("wrong-token"),
      recoveryEnv(registry)
    );

    expect(response.status).toBe(401);
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
      "https://new-tunnel.trycloudflare.com"
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
  timestamp = Math.floor(Date.now() / 1000)
): Promise<Request> {
  const proof = {
    origin: "https://new-tunnel.trycloudflare.com",
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

function memoryRegistry(initial?: string): KeyValueStore {
  const values = new Map<string, string>();
  if (initial) values.set(RADEON_ORIGIN_REGISTRY_KEY, initial);
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value) {
      values.set(key, value);
    }
  };
}
