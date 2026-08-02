import { afterEach, describe, expect, it, vi } from "vitest";
import { getRuntimeDependencyHealth } from "./runtime.js";

describe("runtime dependency health", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RADEON_OPENAI_BASE_URL;
    delete process.env.RADEON_ASR_BASE_URL;
  });

  it("reports unconfigured deterministic dependencies", async () => {
    await expect(getRuntimeDependencyHealth()).resolves.toEqual({
      model: "unconfigured",
      asr: "unconfigured"
    });
  });

  it("requires both Radeon services to report healthy", async () => {
    process.env.RADEON_OPENAI_BASE_URL = "http://127.0.0.1:8000/v1";
    process.env.RADEON_ASR_BASE_URL = "http://127.0.0.1:8001";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: false }), { status: 200 })
        )
    );

    await expect(getRuntimeDependencyHealth()).resolves.toEqual({
      model: "healthy",
      asr: "unavailable"
    });
  });
});
