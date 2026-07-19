import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProofCompatibilityManifest } from "./proof-compatibility.js";
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
      revalidateStoredSkill,
      saveVerifiedSkill
    } = await import("./storage.js");
    const compilation = {
      runId: "run-1",
      createdAt: new Date().toISOString(),
      projectName: "review-followup",
      scenario: "A sufficiently long review scenario.",
      constraints: [],
      permissions: [],
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
        compatibility: createProofCompatibilityManifest(compilation, actions)
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
    const reused = await markSkillReused(second.id);

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
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
    expect(revalidated.skill.actions).toEqual(actions);
    expect((await markSkillReused(second.id)).skill.reuseCount).toBe(2);
  });
});
