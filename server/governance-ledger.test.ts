import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SkillGovernanceReceipt,
  StoredSkill
} from "../shared/types.js";
import {
  governanceLedgerJsonl,
  readGovernanceLedger
} from "./governance-ledger.js";

describe("governance audit ledger", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "rvsf-ledger-"));
    process.env.RVSF_DATA_DIR = directory;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.RVSF_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  });

  it("imports legacy receipts into a valid hash chain and exports JSONL", async () => {
    const skills = sampleSkills();
    const ledger = await readGovernanceLedger(skills);

    expect(ledger.status).toBe("valid");
    expect(ledger.entries.map((entry) => entry.action)).toEqual([
      "PROMOTE",
      "SUPERSEDE",
      "REVOKE",
      "ROLLBACK"
    ]);
    expect(ledger.entries[0].previousHash).toBe("0".repeat(64));
    expect(ledger.entries[1].previousHash).toBe(
      ledger.entries[0].entryHash
    );
    const lines = governanceLedgerJsonl(ledger).trim().split("\n");
    expect(lines).toHaveLength(4);
    expect(lines.map((line) => JSON.parse(line).sequence)).toEqual([
      1, 2, 3, 4
    ]);
  });

  it("detects payload tampering", async () => {
    const skills = sampleSkills();
    await readGovernanceLedger(skills);
    const file = path.join(directory, "governance-ledger.json");
    const entries = JSON.parse(await readFile(file, "utf8"));
    entries[1].reason = "Tampered reason";
    await writeFile(file, JSON.stringify(entries));

    const ledger = await readGovernanceLedger(skills);
    expect(ledger.status).toBe("invalid");
    expect(ledger.issues.join(" ")).toMatch(/payload hash mismatch/i);
  });

  it("detects deleted tail and middle entries", async () => {
    const skills = sampleSkills();
    await readGovernanceLedger(skills);
    const file = path.join(directory, "governance-ledger.json");
    const original = JSON.parse(await readFile(file, "utf8"));

    await writeFile(file, JSON.stringify(original.slice(0, -1)));
    const tailDeleted = await readGovernanceLedger(skills);
    expect(tailDeleted.status).toBe("invalid");
    expect(tailDeleted.issues.join(" ")).toMatch(/missing from the ledger/i);

    await writeFile(
      file,
      JSON.stringify([original[0], original[2], original[3]])
    );
    const middleDeleted = await readGovernanceLedger(skills);
    expect(middleDeleted.status).toBe("invalid");
    expect(middleDeleted.issues.join(" ")).toMatch(
      /out of order|previous hash|missing from the ledger/i
    );
  });
});

function sampleSkills(): StoredSkill[] {
  const receipts: SkillGovernanceReceipt[] = [
    receipt("r1", "PROMOTE", "skill-1", "2026-07-20T00:00:01.000Z"),
    receipt("r2", "SUPERSEDE", "skill-1", "2026-07-20T00:00:02.000Z"),
    receipt("r3", "REVOKE", "skill-2", "2026-07-20T00:00:03.000Z"),
    receipt("r4", "ROLLBACK", "skill-3", "2026-07-20T00:00:04.000Z")
  ];
  return [
    minimalSkill("skill-1", 1, "superseded", receipts.slice(0, 2)),
    minimalSkill("skill-2", 2, "revoked", receipts.slice(2, 3)),
    minimalSkill("skill-3", 3, "promoted", receipts.slice(3))
  ];
}

function receipt(
  receiptId: string,
  action: SkillGovernanceReceipt["action"],
  skillId: string,
  createdAt: string
): SkillGovernanceReceipt {
  return {
    receiptId,
    action,
    skillId,
    proofHash: action.toLowerCase().padEnd(64, "a").slice(0, 64),
    createdAt,
    reason: `${action} test`
  };
}

function minimalSkill(
  id: string,
  version: number,
  lifecycle: StoredSkill["lifecycle"],
  governanceReceipts: SkillGovernanceReceipt[]
): StoredSkill {
  return {
    id,
    name: "ledger-skill",
    version,
    status: "verified",
    lifecycle,
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    reuseCount: 0,
    compilation: {
      runId: `run-${id}`,
      createdAt: "2026-07-20T00:00:00.000Z",
      projectName: "ledger-skill",
      scenario: "A sufficiently long governance ledger test scenario.",
      constraints: [],
      permissions: [],
      fixtures: [],
      skillMarkdown: "# Skill",
      policyYaml: "version: 1",
      compileDurationMs: 1,
      runtime: {
        mode: "deterministic",
        model: "test",
        baseUrlConfigured: false,
        asrModel: "test",
        gpu: "test",
        rocm: "test"
      }
    },
    verification: {
      runId: `run-${id}`,
      status: "verified",
      fixtures: [],
      receipts: [],
      metrics: [],
      proofBundle: {
        proofHash: id.padEnd(64, "b").slice(0, 64)
      },
      verificationDurationMs: 1
    },
    governanceReceipts
  };
}
