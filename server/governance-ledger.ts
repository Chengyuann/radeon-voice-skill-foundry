import type {
  GovernanceLedger,
  GovernanceLedgerEntry,
  SkillGovernanceReceipt,
  StoredSkill
} from "../shared/types.js";
import {
  dataFile,
  readStoredJson,
  updateStoredJson
} from "./file-store.js";
import { stableHash } from "./hash.js";

const ledgerPath = () => dataFile("governance-ledger.json");
const genesisHash = "0".repeat(64);

export async function appendGovernanceLedgerEntry(input: {
  receipt: SkillGovernanceReceipt;
  skillName: string;
  skillVersion: number;
  lifecycleAfter: StoredSkill["lifecycle"];
}): Promise<GovernanceLedgerEntry> {
  return updateStoredJson(
    ledgerPath(),
    [],
    (entries: GovernanceLedgerEntry[]) => {
      const existing = entries.find(
        (entry) => entry.receiptId === input.receipt.receiptId
      );
      if (existing) return structuredClone(existing);
      const previousHash =
        entries[entries.length - 1]?.entryHash || genesisHash;
      const entry = createEntry({
        sequence: entries.length + 1,
        previousHash,
        ...input
      });
      entries.push(entry);
      return structuredClone(entry);
    }
  );
}

export async function readGovernanceLedger(
  skills: StoredSkill[]
): Promise<GovernanceLedger> {
  await importLegacyReceipts(skills);
  const entries = await readStoredJson<GovernanceLedgerEntry[]>(
    ledgerPath(),
    []
  );
  const issues: string[] = [];
  let expectedPreviousHash = genesisHash;
  const seenReceiptIds = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    const expectedSequence = index + 1;
    if (entry.sequence !== expectedSequence) {
      issues.push(
        `Ledger sequence ${entry.sequence} is out of order; expected ${expectedSequence}.`
      );
    }
    if (entry.previousHash !== expectedPreviousHash) {
      issues.push(
        `Ledger entry ${entry.sequence} does not reference the previous hash.`
      );
    }
    const expectedPayloadHash = stableHash(entryPayload(entry));
    if (entry.payloadHash !== expectedPayloadHash) {
      issues.push(`Ledger entry ${entry.sequence} payload hash mismatch.`);
    }
    const expectedEntryHash = stableHash({
      sequence: entry.sequence,
      previousHash: entry.previousHash,
      payloadHash: entry.payloadHash
    });
    if (entry.entryHash !== expectedEntryHash) {
      issues.push(`Ledger entry ${entry.sequence} chain hash mismatch.`);
    }
    if (seenReceiptIds.has(entry.receiptId)) {
      issues.push(`Duplicate governance receipt ${entry.receiptId}.`);
    }
    seenReceiptIds.add(entry.receiptId);
    expectedPreviousHash = entry.entryHash;
  }

  const skillReceiptIds = skills
    .flatMap((skill) => skill.governanceReceipts || [])
    .map((receipt) => receipt.receiptId)
    .sort();
  const ledgerReceiptIds = entries
    .map((entry) => entry.receiptId)
    .sort();
  for (const receiptId of skillReceiptIds) {
    if (!seenReceiptIds.has(receiptId)) {
      issues.push(`Skill receipt ${receiptId} is missing from the ledger.`);
    }
  }
  const skillReceiptSet = new Set(skillReceiptIds);
  for (const receiptId of ledgerReceiptIds) {
    if (!skillReceiptSet.has(receiptId)) {
      issues.push(`Ledger receipt ${receiptId} is missing from skill memory.`);
    }
  }

  return {
    schemaVersion: "0.1.0",
    status: issues.length ? "invalid" : "valid",
    entries: structuredClone(entries),
    headHash: entries[entries.length - 1]?.entryHash || genesisHash,
    receiptCount: entries.length,
    issues,
    checkedAt: new Date().toISOString()
  };
}

export function governanceLedgerJsonl(ledger: GovernanceLedger): string {
  return ledger.entries
    .map((entry) => JSON.stringify(entry))
    .join("\n")
    .concat(ledger.entries.length ? "\n" : "");
}

async function importLegacyReceipts(skills: StoredSkill[]): Promise<void> {
  const existing = await readStoredJson<GovernanceLedgerEntry[]>(
    ledgerPath(),
    []
  );
  if (existing.length) return;
  const importedIds = new Set(existing.map((entry) => entry.receiptId));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const legacy = skills
    .flatMap((skill) =>
      (skill.governanceReceipts || []).map((receipt) => ({
        receipt,
        skill
      }))
    )
    .filter(({ receipt }) => !importedIds.has(receipt.receiptId))
    .sort(
      (a, b) =>
        a.receipt.createdAt.localeCompare(b.receipt.createdAt) ||
        a.receipt.receiptId.localeCompare(b.receipt.receiptId)
    );

  for (const item of legacy) {
    const receiptSkill =
      skillById.get(item.receipt.skillId) || item.skill;
    await appendGovernanceLedgerEntry({
      receipt: item.receipt,
      skillName: receiptSkill.name,
      skillVersion: receiptSkill.version,
      lifecycleAfter: lifecycleAfterAction(item.receipt.action)
    });
  }
}

function createEntry(input: {
  sequence: number;
  previousHash: string;
  receipt: SkillGovernanceReceipt;
  skillName: string;
  skillVersion: number;
  lifecycleAfter: StoredSkill["lifecycle"];
}): GovernanceLedgerEntry {
  const payload = {
    receiptId: input.receipt.receiptId,
    action: input.receipt.action,
    skillId: input.receipt.skillId,
    skillName: input.skillName,
    skillVersion: input.skillVersion,
    lifecycleAfter: input.lifecycleAfter,
    proofHash: input.receipt.proofHash,
    createdAt: input.receipt.createdAt,
    ...(input.receipt.reason ? { reason: input.receipt.reason } : {}),
    ...(input.receipt.sourceSkillId
      ? { sourceSkillId: input.receipt.sourceSkillId }
      : {}),
    ...(input.receipt.replacementSkillId
      ? { replacementSkillId: input.receipt.replacementSkillId }
      : {}),
    ...(input.receipt.reviewHash
      ? { reviewHash: input.receipt.reviewHash }
      : {}),
    ...(input.receipt.riskLevel
      ? { riskLevel: input.receipt.riskLevel }
      : {}),
    ...(input.receipt.riskAcknowledged !== undefined
      ? { riskAcknowledged: input.receipt.riskAcknowledged }
      : {})
  };
  const payloadHash = stableHash(payload);
  return {
    schemaVersion: "0.1.0",
    sequence: input.sequence,
    previousHash: input.previousHash,
    payloadHash,
    entryHash: stableHash({
      sequence: input.sequence,
      previousHash: input.previousHash,
      payloadHash
    }),
    ...payload
  };
}

function entryPayload(entry: GovernanceLedgerEntry) {
  return {
    receiptId: entry.receiptId,
    action: entry.action,
    skillId: entry.skillId,
    skillName: entry.skillName,
    skillVersion: entry.skillVersion,
    lifecycleAfter: entry.lifecycleAfter,
    proofHash: entry.proofHash,
    createdAt: entry.createdAt,
    ...(entry.reason ? { reason: entry.reason } : {}),
    ...(entry.sourceSkillId
      ? { sourceSkillId: entry.sourceSkillId }
      : {}),
    ...(entry.replacementSkillId
      ? { replacementSkillId: entry.replacementSkillId }
      : {}),
    ...(entry.reviewHash ? { reviewHash: entry.reviewHash } : {}),
    ...(entry.riskLevel ? { riskLevel: entry.riskLevel } : {}),
    ...(entry.riskAcknowledged !== undefined
      ? { riskAcknowledged: entry.riskAcknowledged }
      : {})
  };
}

function lifecycleAfterAction(
  action: SkillGovernanceReceipt["action"]
): StoredSkill["lifecycle"] {
  switch (action) {
    case "PROMOTE":
    case "ROLLBACK":
      return "promoted";
    case "SUPERSEDE":
      return "superseded";
    case "REVOKE":
      return "revoked";
  }
}
