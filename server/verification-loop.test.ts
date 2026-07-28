import { beforeEach, describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import { storeCompileRun } from "./runtime-store.js";
import { runVerificationRepairLoop } from "./verification-loop.js";

describe("verification repair loop", () => {
  beforeEach(() => {
    process.env.RVSF_DATA_DIR = `/tmp/rvsf-loop-${crypto.randomUUID()}`;
  });

  it("creates a child revision and re-verifies a repairable policy failure", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const unsafe = {
      ...compilation,
      permissions: compilation.permissions.map((permission) =>
        permission.permission === "mail:send"
          ? { ...permission, state: "allow" as const }
          : permission
      )
    };
    const trustedRun = await storeCompileRun(
      unsafe,
      reviewFollowupDemo.actions
    );
    const result = await runVerificationRepairLoop({
      trustedRun,
      maxAttempts: 2
    });

    expect(result.stoppedReason).toBe("verified");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      status: "quarantined",
      revision: 1
    });
    expect(result.attempts[0].repairInstruction).toMatch(/mail:send/i);
    expect(result.finalCompilation).toMatchObject({
      parentRunId: compilation.runId,
      revision: 2
    });
    expect(result.finalCompilation.revisionHistory?.[1]).toMatchObject({
      source: "verifier",
      findingIds: [expect.stringMatching(/^finding-/)]
    });
    expect(
      result.finalCompilation.permissions.find(
        (permission) => permission.permission === "mail:send"
      )?.state
    ).toBe("deny");
    expect(result.finalVerification.status).toBe("verified");
  });

  it("stops for manual intervention when voice evidence is quarantined", async () => {
    const compilation = await compileSop({
      ...reviewFollowupDemo,
      voiceEvidence: {
        schemaVersion: "0.3.0",
        status: "quarantine",
        qualityScore: 20,
        format: "PCM 16-bit WAV",
        audioSha256: "a".repeat(64),
        issues: ["Audio requires a new recording."],
        diagnostics: [],
        analyzedAt: new Date().toISOString()
      }
    });
    const trustedRun = await storeCompileRun(
      compilation,
      reviewFollowupDemo.actions
    );
    const result = await runVerificationRepairLoop({ trustedRun });

    expect(result.stoppedReason).toBe("manual_intervention_required");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].findings).toContainEqual(
      expect.objectContaining({
        category: "voice",
        repairable: false
      })
    );
  });
});
