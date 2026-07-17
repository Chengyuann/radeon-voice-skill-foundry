import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    const { listSkills, markSkillReused, saveVerifiedSkill } = await import(
      "./storage.js"
    );
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
      runtime: {
        mode: "deterministic" as const,
        model: "test",
        baseUrlConfigured: false,
        asrModel: "test",
        gpu: "test",
        rocm: "test"
      }
    };
    const verification = {
      runId: "run-1",
      status: "verified" as const,
      fixtures: [],
      receipts: [],
      metrics: [],
      proofBundle: {},
      verificationDurationMs: 1
    };
    const first = await saveVerifiedSkill({
      name: "review-followup",
      status: "verified",
      compilation,
      verification
    });
    const second = await saveVerifiedSkill({
      name: "review-followup",
      status: "verified",
      compilation,
      verification
    });
    const reused = await markSkillReused(second.id);

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(reused.skill.reuseCount).toBe(1);
    expect(reused.reuseLatencyMs).toBeGreaterThan(0);
    expect(reused.originalCompileDurationMs).toBe(1);
    expect(reused.speedup).toBeGreaterThan(0);
    expect(await listSkills()).toHaveLength(2);
  });
});
