import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import {
  assessProofCompatibility,
  createProofCompatibilityManifest
} from "./proof-compatibility.js";
import { verifyCompilation } from "./verifier.js";

describe("proof compatibility", () => {
  it("accepts an unchanged verified runtime and tool contract", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );

    expect(
      assessProofCompatibility({
        compilation,
        actions: reviewFollowupDemo.actions,
        verification,
        runtime: compilation.runtime
      }).status
    ).toBe("compatible");
  });

  it("requires revalidation when runtime or tools change", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );
    const compatibility = assessProofCompatibility({
      compilation,
      actions: [
        ...reviewFollowupDemo.actions,
        {
          id: "send-action",
          type: "send_email",
          label: "New send tool",
          timestampMs: 31_000
        }
      ],
      verification,
      runtime: {
        ...compilation.runtime,
        model: "different-model"
      }
    });

    expect(compatibility.status).toBe("revalidation_required");
    expect(compatibility.reasons.join(" ")).toMatch(/runtime|model/i);
    expect(compatibility.reasons.join(" ")).toMatch(/tool contract/i);
  });

  it("requires revalidation when the policy changes after proof", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );
    const changed = {
      ...compilation,
      policyYaml: `${compilation.policyYaml}\n# changed`
    };
    const compatibility = assessProofCompatibility({
      compilation: changed,
      actions: reviewFollowupDemo.actions,
      verification,
      runtime: changed.runtime
    });

    expect(compatibility.status).toBe("revalidation_required");
    expect(compatibility.reasons).toContain(
      "Stored policy changed after verification."
    );
  });

  it("uses the current compatibility schema", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    expect(
      createProofCompatibilityManifest(
        compilation,
        reviewFollowupDemo.actions
      ).schemaVersion
    ).toBe("0.3.0");
  });

  it("invalidates proofs created before Voice Evidence v0.3", async () => {
    const compilation = await compileSop({
      ...reviewFollowupDemo,
      voiceEvidence: {
        schemaVersion: "0.3.0",
        status: "pass",
        qualityScore: 100,
        format: "PCM 16-bit WAV",
        sampleRateHz: 16_000,
        channels: 1,
        durationSeconds: 4,
        burstLossRatio: 0,
        audioSha256: "a".repeat(64),
        issues: [],
        diagnostics: [],
        analyzedAt: "2026-07-18T00:00:00.000Z"
      }
    });
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );
    const compatibility = verification.proofBundle.compatibility as {
      schemaVersion: "0.2.0" | "0.3.0";
      voiceEvidenceSchemaVersion?: "0.1.0" | "0.2.0" | "0.3.0";
    };
    const legacyVerification = {
      ...verification,
      proofBundle: {
        ...verification.proofBundle,
        compatibility: {
          ...compatibility,
          schemaVersion: "0.2.0",
          voiceEvidenceSchemaVersion: "0.2.0"
        }
      }
    };
    const assessed = assessProofCompatibility({
      compilation,
      actions: reviewFollowupDemo.actions,
      verification: legacyVerification,
      runtime: compilation.runtime
    });

    expect(assessed.status).toBe("revalidation_required");
    expect(assessed.reasons).toContain("Voice evidence schema changed.");
  });
});
