import { describe, expect, it } from "vitest";
import type { StoredSkill } from "../shared/types.js";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import { createProofCompatibilityManifest } from "./proof-compatibility.js";
import { buildPromotionReview } from "./promotion-review.js";

async function storedSkill(
  id: string,
  version: number,
  lifecycle: StoredSkill["lifecycle"]
): Promise<StoredSkill> {
  const compilation = await compileSop(reviewFollowupDemo);
  const proofHash = id.padEnd(64, "a").slice(0, 64);
  return {
    id,
    name: compilation.projectName,
    version,
    status: "verified",
    lifecycle,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    reuseCount: 0,
    compilation,
    verification: {
      runId: compilation.runId,
      status: "verified",
      fixtures: [],
      receipts: [],
      metrics: [],
      proofBundle: {
        proofHash,
        compatibility: createProofCompatibilityManifest(
          compilation,
          reviewFollowupDemo.actions
        )
      },
      verificationDurationMs: 1
    },
    actions: reviewFollowupDemo.actions,
    governanceReceipts: []
  };
}

describe("promotion impact review", () => {
  it("produces a stable low-risk review for an unchanged version", async () => {
    const baseline = await storedSkill("skill_baseline", 1, "promoted");
    const candidate = {
      ...(await storedSkill("skill_candidate", 2, "candidate")),
      compilation: baseline.compilation,
      actions: baseline.actions
    };
    const first = buildPromotionReview({
      candidate,
      baseline,
      candidateActions: candidate.actions!,
      baselineActions: baseline.actions
    });
    const second = buildPromotionReview({
      candidate,
      baseline,
      candidateActions: candidate.actions!,
      baselineActions: baseline.actions
    });

    expect(first.riskLevel).toBe("low");
    expect(first.requiresRiskAcknowledgement).toBe(false);
    expect(first.changes.permissions).toHaveLength(0);
    expect(first.reviewHash).toBe(second.reviewHash);
  });

  it("flags permission escalation and removed guardrails as critical", async () => {
    const baseline = await storedSkill("skill_safe", 1, "promoted");
    const candidate = await storedSkill("skill_risky", 2, "candidate");
    candidate.compilation = {
      ...candidate.compilation,
      permissions: candidate.compilation.permissions.map((permission) =>
        permission.permission === "mail:send"
          ? { ...permission, state: "allow" as const }
          : permission
      ),
      constraints: candidate.compilation.constraints.filter(
        (constraint) => constraint.kind !== "redact"
      )
    };
    const review = buildPromotionReview({
      candidate,
      baseline,
      candidateActions: [
        ...candidate.actions!,
        {
          id: "send",
          type: "send_email",
          label: "Send email",
          timestampMs: 32_000
        }
      ],
      baselineActions: baseline.actions
    });

    expect(review.riskLevel).toBe("critical");
    expect(review.requiresRiskAcknowledgement).toBe(true);
    expect(review.risks.map((risk) => risk.category)).toEqual(
      expect.arrayContaining(["permission", "constraint", "action"])
    );
  });

  it("changes the review hash when the promoted baseline changes", async () => {
    const candidate = await storedSkill("skill_candidate", 3, "candidate");
    const baselineOne = await storedSkill("skill_one", 1, "promoted");
    const baselineTwo = await storedSkill("skill_two", 2, "promoted");

    const first = buildPromotionReview({
      candidate,
      baseline: baselineOne,
      candidateActions: candidate.actions!,
      baselineActions: baselineOne.actions
    });
    const second = buildPromotionReview({
      candidate,
      baseline: baselineTwo,
      candidateActions: candidate.actions!,
      baselineActions: baselineTwo.actions
    });

    expect(first.reviewHash).not.toBe(second.reviewHash);
  });
});
