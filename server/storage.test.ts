import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProofCompatibilityManifest } from "./proof-compatibility.js";
import { buildSubmissionPackage } from "./package.js";
import { getRuntimeInfo } from "./runtime.js";

describe("local RAG and skill memory", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "rvsf-storage-"));
    process.env.RVSF_DATA_DIR = directory;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.RVSF_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  });

  it("retrieves privacy policy evidence", async () => {
    const { searchKnowledge } = await import("./storage.js");
    const results = await searchKnowledge(
      "external report compensation data redaction"
    );
    expect(results[0]?.title).toBe("External Reporting and Privacy Policy");
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it("persists and versions verified skills", async () => {
    const {
      listSkills,
      markSkillReused,
      getSkillPromotionReview,
      promoteStoredSkill,
      revalidateStoredSkill,
      revokeStoredSkill,
      rollbackStoredSkill,
      saveVerifiedSkill
    } = await import("./storage.js");
    const compilation = {
      runId: "run-1",
      createdAt: new Date().toISOString(),
      projectName: "review-followup",
      scenario: "A sufficiently long review scenario.",
      constraints: [
        {
          id: "rule-no-send",
          kind: "must_not" as const,
          statement: "Prohibit automatic sending",
          sourceText: "Do not send automatically",
          confidence: 1,
          appliesTo: ["draft_email"]
        },
        {
          id: "rule-redact",
          kind: "redact" as const,
          statement: "Redact compensation and customer names",
          sourceText: "Never include compensation or customer names",
          confidence: 1,
          appliesTo: ["write_report"]
        },
        {
          id: "rule-scope",
          kind: "only_if" as const,
          statement: "Only include P0 and P1",
          sourceText: "Only include P0 and P1",
          confidence: 1,
          appliesTo: ["filter_findings"]
        },
        {
          id: "rule-owner",
          kind: "requires_confirmation" as const,
          statement: "Require confirmation when owner is missing",
          sourceText: "Do not guess missing owners",
          confidence: 1,
          appliesTo: ["select_commitment"]
        }
      ],
      permissions: [
        {
          id: "perm-mail-send",
          permission: "mail:send",
          state: "deny" as const,
          reason: "Automatic sending is prohibited"
        },
        {
          id: "perm-network",
          permission: "network:write",
          state: "deny" as const,
          reason: "Local-only verification"
        }
      ],
      fixtures: [],
      skillMarkdown: "# Skill",
      policyYaml: "version: 1",
      compileDurationMs: 1,
      runtime: getRuntimeInfo()
    };
    const actions = [
      {
        id: "action-1",
        type: "open_document" as const,
        label: "Open document",
        timestampMs: 0
      },
      {
        id: "action-2",
        type: "filter_findings" as const,
        label: "Keep P0 and P1 findings",
        timestampMs: 1250,
        payload: { severities: ["P0", "P1"], excluded: ["P2"] }
      },
      {
        id: "action-3",
        type: "select_commitment" as const,
        label: "Mark missing owner for confirmation",
        timestampMs: 2500,
        payload: { ownerState: "needs_confirmation", guessedOwner: false }
      },
      {
        id: "action-4",
        type: "draft_email" as const,
        label: "Create email drafts",
        timestampMs: 3750,
        payload: { state: "draft", send: false }
      },
      {
        id: "action-5",
        type: "create_calendar_hold" as const,
        label: "Create tentative calendar holds",
        timestampMs: 5000,
        payload: { tentative: true, committed: false }
      },
      {
        id: "action-6",
        type: "write_report" as const,
        label: "Write redacted report",
        timestampMs: 6250,
        payload: {
          redactedFields: ["compensation", "customerName"],
          customer: "Account N7"
        }
      }
    ];
    const verification = {
      runId: "run-1",
      status: "verified" as const,
      fixtures: [],
      receipts: [],
      metrics: [],
      proofBundle: {
        compatibility: createProofCompatibilityManifest(compilation, actions),
        proofHash: "f".repeat(64)
      },
      verificationDurationMs: 1
    };
    const first = await saveVerifiedSkill({
      name: "review-followup",
      status: "verified",
      compilation,
      verification,
      actions
    });
    const second = await saveVerifiedSkill({
      name: "review-followup",
      status: "verified",
      compilation,
      verification,
      actions
    });
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(first.lifecycle).toBe("candidate");
    expect(second.lifecycle).toBe("candidate");
    await expect(markSkillReused(second.id)).rejects.toThrow(
      "promote it before reuse"
    );
    const firstReview = await getSkillPromotionReview(first.id);
    await expect(
      promoteStoredSkill(first.id, {
        reviewHash: "0".repeat(64),
        acknowledgeRisk: true
      })
    ).rejects.toThrow("stale");
    if (firstReview.requiresRiskAcknowledgement) {
      await expect(
        promoteStoredSkill(first.id, {
          reviewHash: firstReview.reviewHash,
          acknowledgeRisk: false
        })
      ).rejects.toThrow("acknowledgement");
    }
    const promotedFirst = await promoteStoredSkill(first.id, {
      reviewHash: firstReview.reviewHash,
      acknowledgeRisk: true
    });
    const reusedFirst = await markSkillReused(first.id);
    const secondReview = await getSkillPromotionReview(second.id);
    expect(secondReview.baseline?.skillId).toBe(first.id);
    const promotedSecond = await promoteStoredSkill(second.id, {
      reviewHash: secondReview.reviewHash,
      acknowledgeRisk: true
    });
    const skillsAfterPromotion = await listSkills();
    const supersededFirst = skillsAfterPromotion.find(
      (skill) => skill.id === first.id
    );
    const reused = await markSkillReused(second.id);

    expect(promotedFirst.lifecycle).toBe("promoted");
    expect(promotedFirst.promotedProofHash).toBe(
      verification.proofBundle.proofHash
    );
    expect(
      promotedFirst.governanceReceipts.find(
        (receipt) => receipt.action === "PROMOTE"
      )
    ).toMatchObject({
      reviewHash: firstReview.reviewHash,
      riskLevel: firstReview.riskLevel,
      riskAcknowledged: true
    });
    expect(reusedFirst.skill.reuseCount).toBe(1);
    expect(promotedSecond.lifecycle).toBe("promoted");
    expect(supersededFirst?.lifecycle).toBe("superseded");
    expect(
      supersededFirst?.governanceReceipts.some(
        (receipt) => receipt.action === "SUPERSEDE"
      )
    ).toBe(true);
    expect(reused.skill.reuseCount).toBe(1);
    expect(reused.reuseLatencyMs).toBeGreaterThan(0);
    expect(reused.originalCompileDurationMs).toBe(1);
    expect(reused.speedup).toBeGreaterThan(0);
    expect(reused.compatibility.status).toBe("compatible");
    expect(reused.skill.actions).toEqual(actions);
    expect(await listSkills()).toHaveLength(2);

    const storedFile = path.join(directory, "skills.json");
    const storedSkills = JSON.parse(
      await (await import("node:fs/promises")).readFile(storedFile, "utf8")
    );
    storedSkills[1].verification.proofBundle.compatibility.runtimeHash =
      "stale-runtime";
    await (await import("node:fs/promises")).writeFile(
      storedFile,
      JSON.stringify(storedSkills)
    );

    await expect(markSkillReused(second.id)).rejects.toThrow(
      "Proof revalidation required"
    );
    const revalidated = await revalidateStoredSkill(second.id);
    expect(revalidated.compatibility.status).toBe("compatible");
    expect(revalidated.skill.status).toBe("verified");
    expect(revalidated.skill.lifecycle).toBe("candidate");
    expect(revalidated.skill.actions).toEqual(actions);
    await expect(markSkillReused(second.id)).rejects.toThrow(
      "promote it before reuse"
    );
    const repromotionReview = await getSkillPromotionReview(second.id);
    const repromoted = await promoteStoredSkill(second.id, {
      reviewHash: repromotionReview.reviewHash,
      acknowledgeRisk: true
    });
    expect(repromoted.lifecycle).toBe("promoted");

    const revoked = await revokeStoredSkill(
      second.id,
      "Policy owner requested an emergency stop"
    );
    expect(revoked.lifecycle).toBe("revoked");
    expect(revoked.revocationReason).toMatch(/emergency stop/);
    await expect(markSkillReused(second.id)).rejects.toThrow(
      "revoked"
    );

    const rolledBack = await rollbackStoredSkill(
      first.id,
      "Restore the last known safe policy"
    );
    expect(rolledBack.version).toBe(3);
    expect(rolledBack.lifecycle).toBe("promoted");
    expect(rolledBack.rollbackFromSkillId).toBe(first.id);
    expect(
      rolledBack.governanceReceipts.some(
        (receipt) =>
          receipt.action === "ROLLBACK" &&
          receipt.sourceSkillId === first.id
      )
    ).toBe(true);
    expect((await markSkillReused(rolledBack.id)).skill.reuseCount).toBe(1);
  });

  it("packages the server-authoritative action contract", async () => {
    const JSZip = (await import("jszip")).default;
    const actions = [
      {
        id: "action-1",
        type: "open_document" as const,
        label: "Open document",
        timestampMs: 0
      }
    ];
    const compilation = {
      runId: "run-package",
      createdAt: new Date().toISOString(),
      projectName: "action-contract-package",
      scenario: "A sufficiently long package scenario.",
      constraints: [],
      permissions: [],
      fixtures: [],
      skillMarkdown: "# Skill",
      policyYaml: "version: 1",
      compileDurationMs: 1,
      runtime: getRuntimeInfo(),
      demonstrationSessionId: "demo_123456789abc"
    };
    const verification = {
      runId: compilation.runId,
      status: "verified" as const,
      fixtures: [],
      receipts: [],
      metrics: [],
      proofBundle: {
        actionContract: {
          sessionId: compilation.demonstrationSessionId,
          hash: "a".repeat(64),
          eventCount: actions.length,
          events: actions
        },
        sandboxReplay: {
          schemaVersion: "0.1.0",
          status: "passed",
          initialHash: "b".repeat(64),
          finalHash: "c".repeat(64),
          steps: [],
          probes: [],
          finalState: {
            documentOpen: false,
            visibleFindingIds: [],
            ownerStates: {},
            emailDrafts: [],
            calendarHolds: [],
            externalEffects: {
              emailsSent: 0,
              calendarCommitted: 0,
              networkWrites: 0
            }
          },
          summary: {
            drafts: 0,
            tentativeHolds: 0,
            reportRecords: 0,
            externalSideEffects: 0
          }
        }
      },
      verificationDurationMs: 1
    };
    const archive = await buildSubmissionPackage(compilation, verification);
    const zip = await JSZip.loadAsync(archive);
    const contractFile = zip.file(
      "action-contract-package/action_contract.json"
    );
    const replayFile = zip.file(
      "action-contract-package/sandbox_replay.json"
    );

    expect(contractFile).not.toBeNull();
    expect(replayFile).not.toBeNull();
    expect(JSON.parse(await contractFile!.async("string"))).toMatchObject({
      sessionId: "demo_123456789abc",
      eventCount: 1,
      events: actions
    });
    expect(JSON.parse(await replayFile!.async("string"))).toMatchObject({
      schemaVersion: "0.1.0",
      status: "passed"
    });
  });
});
