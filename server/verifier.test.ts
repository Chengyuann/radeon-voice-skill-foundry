import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import { stableHash } from "./hash.js";
import { verifyCompilation } from "./verifier.js";

describe("proof verifier", () => {
  it("binds the complete action contract into the proof core", async () => {
    const compilation = await compileSop({
      ...reviewFollowupDemo,
      demonstrationSessionId: "demo_123456789abc"
    });
    const result = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );

    expect(result.proofBundle.actionContract).toEqual({
      sessionId: "demo_123456789abc",
      hash: stableHash(reviewFollowupDemo.actions),
      eventCount: reviewFollowupDemo.actions.length,
      events: reviewFollowupDemo.actions
    });
  });

  it("verifies the complete demo and issues governance receipts", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const result = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );

    expect(result.status).toBe("verified");
    expect(result.fixtures.every((fixture) => fixture.status === "passed")).toBe(
      true
    );
    expect(result.receipts.some((receipt) => receipt.decision === "BLOCK")).toBe(
      true
    );
    expect(result.proofBundle).toHaveProperty("proofHash");
    expect(result.proofBundle).toMatchObject({
      schemaVersion: "0.4.0",
      sandboxReplay: {
        status: "passed",
        summary: {
          drafts: 2,
          tentativeHolds: 2,
          reportRecords: 2,
          externalSideEffects: 0
        }
      }
    });
  });

  it("quarantines a skill when an adversarial probe fails", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const unsafe = {
      ...compilation,
      permissions: compilation.permissions.map((permission) =>
        permission.permission === "mail:send"
          ? { ...permission, state: "allow" as const }
          : permission
      )
    };
    const result = await verifyCompilation(
      unsafe,
      reviewFollowupDemo.actions
    );

    expect(result.status).toBe("quarantined");
    expect(result.fixtures).toContainEqual(
      expect.objectContaining({
        name: "Automatic send is blocked",
        status: "failed"
      })
    );
  });

  it("quarantines a voice-seeded skill when audio evidence fails", async () => {
    const compilation = await compileSop({
      ...reviewFollowupDemo,
      voiceEvidence: {
        schemaVersion: "0.1.0",
        status: "quarantine",
        qualityScore: 5,
        format: "PCM 16-bit WAV",
        audioSha256: "a".repeat(64),
        issues: ["Audio is mostly silent."],
        analyzedAt: new Date().toISOString()
      }
    });
    const result = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );

    expect(result.status).toBe("quarantined");
    expect(
      result.fixtures.find(
        (fixture) => fixture.name === "Voice evidence gate is satisfied"
      )?.status
    ).toBe("failed");
  });

  it("accepts review-quality audio only after transcript acknowledgement", async () => {
    const base = {
      ...reviewFollowupDemo,
      voiceEvidence: {
        schemaVersion: "0.1.0" as const,
        status: "review" as const,
        qualityScore: 78,
        format: "PCM 16-bit WAV",
        audioSha256: "b".repeat(64),
        issues: ["Speech level is low."],
        analyzedAt: new Date().toISOString()
      }
    };
    const unreviewed = await compileSop(base);
    const unreviewedResult = await verifyCompilation(
      unreviewed,
      reviewFollowupDemo.actions
    );
    const reviewed = await compileSop({
      ...base,
      voiceEvidenceReviewed: true
    });
    const reviewedResult = await verifyCompilation(
      reviewed,
      reviewFollowupDemo.actions
    );

    expect(unreviewedResult.status).toBe("quarantined");
    expect(reviewedResult.status).toBe("verified");
    expect(
      reviewedResult.receipts.some(
        (receipt) => receipt.decision === "REVIEW"
      )
    ).toBe(true);
  });

  it("requires acknowledgement when the ASR transcript was edited", async () => {
    const base = {
      ...reviewFollowupDemo,
      voiceEvidence: {
        schemaVersion: "0.1.0" as const,
        status: "pass" as const,
        qualityScore: 98,
        format: "PCM 16-bit WAV",
        audioSha256: "c".repeat(64),
        asrTranscriptSha256: "d".repeat(64),
        issues: [],
        analyzedAt: new Date().toISOString()
      },
      voiceTranscriptModified: true
    };
    const unreviewed = await compileSop(base);
    const unreviewedResult = await verifyCompilation(
      unreviewed,
      reviewFollowupDemo.actions
    );
    const reviewed = await compileSop({
      ...base,
      voiceEvidenceReviewed: true
    });
    const reviewedResult = await verifyCompilation(
      reviewed,
      reviewFollowupDemo.actions
    );

    expect(unreviewedResult.status).toBe("quarantined");
    expect(reviewedResult.status).toBe("verified");
    expect(reviewedResult.proofBundle).toMatchObject({
      voiceTranscriptModified: true,
      voiceEvidenceReviewed: true
    });
  });

  it("binds parent-child lineage into the proof bundle", async () => {
    const parent = await compileSop(reviewFollowupDemo);
    const child = {
      ...parent,
      runId: "revalidate_lineage_test",
      parentRunId: parent.runId,
      revision: 2,
      revisionHistory: [
        ...(parent.revisionHistory || []),
        {
          revision: 2,
          runId: "revalidate_lineage_test",
          parentRunId: parent.runId,
          createdAt: new Date().toISOString(),
          instruction: "Always require confirmation before calendar holds.",
          status: "compiled" as const,
          addedConstraints: ["Require confirmation before calendar holds"],
          removedConstraints: [],
          permissionChanges: [],
          fixtureCount: parent.fixtures.length
        }
      ]
    };
    const result = await verifyCompilation(
      child,
      reviewFollowupDemo.actions
    );

    expect(result.proofBundle).toMatchObject({
      runId: "revalidate_lineage_test",
      parentRunId: parent.runId,
      revision: 2,
      revisionHistory: [
        expect.objectContaining({
          revision: 1,
          status: "compiled"
        }),
        expect.objectContaining({
          revision: 2,
          status: "verified"
        })
      ]
    });
  });
});
