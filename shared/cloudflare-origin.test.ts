import { describe, expect, it, vi } from "vitest";
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
    const fetcher = vi.fn<typeof fetch>();
    const response = await handleOriginRecovery(
      recoveryRequest("wrong-token"),
      recoveryEnv(registry),
      fetcher
    );

    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await registry.get(RADEON_ORIGIN_REGISTRY_KEY)).toBeNull();
  });

  it("writes a new origin only after authenticated Radeon health validation", async () => {
    const registry = memoryRegistry();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ok: true,
        runtime: {
          mode: "radeon",
          model: "Qwen/Qwen3-4B-Instruct-2507",
          baseUrlConfigured: true,
          gpu: "AMD Radeon Pro W7900-class gfx1100 48GB",
          rocm: "ROCm 7.2.1"
        }
      })
    );
    const response = await handleOriginRecovery(
      recoveryRequest("recovery-token"),
      recoveryEnv(registry),
      fetcher
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith(
      "https://new-tunnel.trycloudflare.com/api/health",
      expect.objectContaining({
        headers: { "x-rvsf-api-token": "api-token" }
      })
    );
    expect(await registry.get(RADEON_ORIGIN_REGISTRY_KEY)).toBe(
      "https://new-tunnel.trycloudflare.com"
    );
  });

  it("does not register a non-Radeon health response", async () => {
    const registry = memoryRegistry();
    const response = await handleOriginRecovery(
      recoveryRequest("recovery-token"),
      recoveryEnv(registry),
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ok: true,
          runtime: {
            mode: "deterministic",
            model: "fixture",
            baseUrlConfigured: false,
            gpu: "none",
            rocm: "none"
          }
        })
      )
    );

    expect(response.status).toBe(502);
    expect(await registry.get(RADEON_ORIGIN_REGISTRY_KEY)).toBeNull();
  });
});

function recoveryRequest(token: string): Request {
  return new Request(
    "https://radeon-voice-skill-foundry.pages.dev/internal/origin-recovery",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rvsf-origin-recovery-token": token
      },
      body: JSON.stringify({
        origin: "https://new-tunnel.trycloudflare.com"
      })
    }
  );
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
