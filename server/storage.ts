import type {
  ActionEvent,
  CompileResult,
  KnowledgeDocument,
  KnowledgeMatch,
  SkillGovernanceReceipt,
  SkillReuseResult,
  SkillRevalidationResult,
  StoredSkill
} from "../shared/types.js";
import { dataFile, readStoredJson, updateStoredJson } from "./file-store.js";
import { id } from "./hash.js";
import { assessProofCompatibility } from "./proof-compatibility.js";
import { getRuntimeInfo } from "./runtime.js";
import { verifyCompilation } from "./verifier.js";

const knowledgePath = () => dataFile("knowledge.json");
const skillsPath = () => dataFile("skills.json");

const seedDocuments: KnowledgeDocument[] = [
  {
    id: "policy-external-reporting",
    title: "External Reporting and Privacy Policy",
    content:
      "External reports must exclude compensation, salary, personal identifiers, and internal financial details. Customer names must be replaced by approved account aliases. Any uncertain redaction requires human review.",
    createdAt: "2026-07-17T00:00:00.000Z",
    source: "seed"
  },
  {
    id: "policy-email-actions",
    title: "Email and Calendar Action Policy",
    content:
      "Agents may create email drafts and tentative calendar holds. Sending email, publishing content, deleting records, or committing calendar invitations requires explicit human approval. Missing owners or missing deadlines must not be guessed.",
    createdAt: "2026-07-17T00:00:00.000Z",
    source: "seed"
  },
  {
    id: "sop-review-followup",
    title: "Project Review Follow-up SOP",
    content:
      "Prioritize P0 and P1 findings. Resolve owners and due dates from the review note. Draft owner follow-ups, create tentative holds only when dates are present, and produce a redacted external audit report.",
    createdAt: "2026-07-17T00:00:00.000Z",
    source: "seed"
  }
];

export async function listKnowledge(): Promise<KnowledgeDocument[]> {
  return readStoredJson(knowledgePath(), seedDocuments);
}

export async function addKnowledge(
  input: Pick<KnowledgeDocument, "title" | "content">
): Promise<KnowledgeDocument> {
  const document: KnowledgeDocument = {
    id: id("doc"),
    title: input.title,
    content: input.content,
    createdAt: new Date().toISOString(),
    source: "user"
  };
  return updateStoredJson(
    knowledgePath(),
    seedDocuments,
    (storedDocuments: KnowledgeDocument[]) => {
      storedDocuments.push(document);
      return structuredClone(document);
    }
  );
}

export async function searchKnowledge(
  query: string,
  limit = 4
): Promise<KnowledgeMatch[]> {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const documents = await listKnowledge();
  return documents
    .map((document) => {
      const titleTerms = tokenize(document.title);
      const contentTerms = tokenize(document.content);
      const titleHits = terms.filter((term) => titleTerms.includes(term)).length;
      const contentHits = terms.filter((term) =>
        contentTerms.includes(term)
      ).length;
      const score =
        (titleHits * 3 + contentHits) /
        Math.max(terms.length + Math.log2(contentTerms.length + 2), 1);
      return {
        documentId: document.id,
        title: document.title,
        excerpt: excerptFor(document.content, terms),
        score: Math.round(score * 1000) / 1000
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function listSkills(): Promise<StoredSkill[]> {
  return updateStoredJson(skillsPath(), [], (skills: StoredSkill[]) => {
    for (let index = 0; index < skills.length; index += 1) {
      const normalized = normalizeStoredSkill(skills[index]);
      const actions = resolveStoredSkillActions(normalized);
      const compatibility = assessProofCompatibility({
        compilation: normalized.compilation,
        actions,
        verification: normalized.verification,
        runtime: getRuntimeInfo()
      });
      skills[index] = {
        ...normalized,
        actions,
        compatibility,
        status:
          compatibility.status === "compatible"
            ? "verified"
            : "revalidation_required"
      };
    }
    return structuredClone(skills);
  });
}

export async function saveVerifiedSkill(
  skill: Omit<
    StoredSkill,
    | "id"
    | "version"
    | "createdAt"
    | "updatedAt"
    | "reuseCount"
    | "compatibility"
    | "lifecycle"
    | "governanceReceipts"
    | "promotedAt"
    | "promotedProofHash"
    | "revokedAt"
    | "revocationReason"
    | "supersededAt"
    | "supersededBySkillId"
    | "rollbackFromSkillId"
  > & { actions: ActionEvent[] }
): Promise<StoredSkill> {
  return updateStoredJson(skillsPath(), [], (skills: StoredSkill[]) => {
    const current = skills
      .filter((item) => item.name === skill.name)
      .sort((a, b) => b.version - a.version)[0];
    const now = new Date().toISOString();
    const actions = skill.actions;
    const compatibility = assessProofCompatibility({
      compilation: skill.compilation,
      actions,
      verification: skill.verification,
      runtime: getRuntimeInfo()
    });
    const stored: StoredSkill = {
      ...skill,
      id: id("skill"),
      version: (current?.version || 0) + 1,
      createdAt: now,
      updatedAt: now,
      reuseCount: 0,
      lifecycle: "candidate",
      governanceReceipts: [],
      actions,
      compatibility
    };
    stored.status =
      compatibility.status === "compatible"
        ? "verified"
        : "revalidation_required";
    skills.push(stored);
    return structuredClone(stored);
  });
}

export async function markSkillReused(
  idValue: string
): Promise<SkillReuseResult> {
  const startedAt = performance.now();
  return updateStoredJson(skillsPath(), [], (skills: StoredSkill[]) => {
    const index = skills.findIndex((skill) => skill.id === idValue);
    if (index < 0) throw new Error("Stored skill not found");
    skills[index] = normalizeStoredSkill(skills[index]);
    if (skills[index].lifecycle !== "promoted") {
      throw new Error(
        `Skill is ${skills[index].lifecycle}; promote it before reuse`
      );
    }
    const actions = resolveStoredSkillActions(skills[index]);
    const compatibility = assessProofCompatibility({
      compilation: skills[index].compilation,
      actions,
      verification: skills[index].verification,
      runtime: getRuntimeInfo()
    });
    if (compatibility.status !== "compatible") {
      skills[index] = {
        ...skills[index],
        status: "revalidation_required",
        compatibility,
        updatedAt: new Date().toISOString()
      };
      throw new Error(
        `Proof revalidation required: ${compatibility.reasons.join(" ")}`
      );
    }
    skills[index] = {
      ...skills[index],
      status: "verified",
      compatibility,
      actions,
      reuseCount: skills[index].reuseCount + 1,
      updatedAt: new Date().toISOString()
    };
    const skill = structuredClone(skills[index]);
    const reuseLatencyMs = roundDuration(performance.now() - startedAt);
    const originalCompileDurationMs = skill.compilation.compileDurationMs;
    return {
      skill,
      reuseLatencyMs,
      originalCompileDurationMs,
      speedup: roundRatio(
        originalCompileDurationMs / Math.max(reuseLatencyMs, 0.01)
      ),
      ...(skill.compilation.modelMetrics
        ? {
            avoidedModelOutputTokens:
              skill.compilation.modelMetrics.outputTokens
          }
        : {}),
      compatibility
    };
  });
}

export async function revalidateStoredSkill(
  idValue: string
): Promise<SkillRevalidationResult> {
  return updateStoredJson(skillsPath(), [], async (skills: StoredSkill[]) => {
    const index = skills.findIndex((skill) => skill.id === idValue);
    if (index < 0) throw new Error("Stored skill not found");
    skills[index] = normalizeStoredSkill(skills[index]);
    if (
      skills[index].lifecycle === "revoked" ||
      skills[index].lifecycle === "superseded"
    ) {
      throw new Error(
        `Cannot revalidate a ${skills[index].lifecycle} skill; roll it back instead`
      );
    }
    const actions = resolveStoredSkillActions(skills[index]);
    const now = new Date().toISOString();
    const compilation: CompileResult = {
      ...skills[index].compilation,
      runId: id("revalidate"),
      createdAt: now,
      runtime: getRuntimeInfo(),
      parentRunId: skills[index].compilation.runId,
      revision: (skills[index].compilation.revision || 1) + 1
    };
    const verification = await verifyCompilation(
      compilation,
      actions
    );
    const compatibility = assessProofCompatibility({
      compilation,
      actions,
      verification,
      runtime: getRuntimeInfo()
    });
    skills[index] = {
      ...skills[index],
      status:
        verification.status === "verified" &&
        compatibility.status === "compatible"
          ? "verified"
          : "revalidation_required",
      verification,
      compilation,
      actions,
      compatibility,
      lifecycle: "candidate",
      promotedAt: undefined,
      promotedProofHash: undefined,
      updatedAt: now
    };
    return {
      skill: structuredClone(skills[index]),
      verification: structuredClone(verification),
      compatibility
    };
  });
}

export async function promoteStoredSkill(
  idValue: string
): Promise<StoredSkill> {
  return updateStoredJson(skillsPath(), [], (skills: StoredSkill[]) => {
    const index = skills.findIndex((skill) => skill.id === idValue);
    if (index < 0) throw new Error("Stored skill not found");
    skills[index] = normalizeStoredSkill(skills[index]);
    const actions = resolveStoredSkillActions(skills[index]);
    const compatibility = assessProofCompatibility({
      compilation: skills[index].compilation,
      actions,
      verification: skills[index].verification,
      runtime: getRuntimeInfo()
    });
    if (
      skills[index].verification.status !== "verified" ||
      compatibility.status !== "compatible"
    ) {
      throw new Error("Only a verified, proof-compatible skill can be promoted");
    }
    if (skills[index].lifecycle !== "candidate") {
      throw new Error(
        `Only a candidate skill can be promoted; current state is ${skills[index].lifecycle}`
      );
    }
    const now = new Date().toISOString();
    const proofHash = proofHashFor(skills[index]);
    for (let otherIndex = 0; otherIndex < skills.length; otherIndex += 1) {
      if (otherIndex === index) continue;
      const other = normalizeStoredSkill(skills[otherIndex]);
      if (
        other.name !== skills[index].name ||
        other.lifecycle !== "promoted"
      ) {
        skills[otherIndex] = other;
        continue;
      }
      skills[otherIndex] = {
        ...other,
        lifecycle: "superseded",
        supersededAt: now,
        supersededBySkillId: idValue,
        updatedAt: now,
        governanceReceipts: [
          ...other.governanceReceipts,
          governanceReceipt({
            action: "SUPERSEDE",
            skillId: other.id,
            proofHash: proofHashFor(other),
            replacementSkillId: idValue,
            reason: `Promoted ${skills[index].name} v${skills[index].version}`
          })
        ]
      };
    }
    skills[index] = {
      ...skills[index],
      lifecycle: "promoted",
      status: "verified",
      actions,
      compatibility,
      promotedAt: now,
      promotedProofHash: proofHash,
      updatedAt: now,
      governanceReceipts: [
        ...skills[index].governanceReceipts,
        governanceReceipt({
          action: "PROMOTE",
          skillId: idValue,
          proofHash,
          reason: "Human promotion gate approved"
        })
      ]
    };
    return structuredClone(skills[index]);
  });
}

export async function revokeStoredSkill(
  idValue: string,
  reason: string
): Promise<StoredSkill> {
  return updateStoredJson(skillsPath(), [], (skills: StoredSkill[]) => {
    const index = skills.findIndex((skill) => skill.id === idValue);
    if (index < 0) throw new Error("Stored skill not found");
    const skill = normalizeStoredSkill(skills[index]);
    if (skill.lifecycle === "revoked") {
      throw new Error("Skill is already revoked");
    }
    if (skill.lifecycle === "superseded") {
      throw new Error("Superseded skills are immutable; use rollback");
    }
    const now = new Date().toISOString();
    skills[index] = {
      ...skill,
      lifecycle: "revoked",
      revokedAt: now,
      revocationReason: reason,
      updatedAt: now,
      governanceReceipts: [
        ...skill.governanceReceipts,
        governanceReceipt({
          action: "REVOKE",
          skillId: skill.id,
          proofHash: proofHashFor(skill),
          reason
        })
      ]
    };
    return structuredClone(skills[index]);
  });
}

export async function rollbackStoredSkill(
  idValue: string,
  reason: string
): Promise<StoredSkill> {
  return updateStoredJson(skillsPath(), [], async (skills: StoredSkill[]) => {
    const sourceIndex = skills.findIndex((skill) => skill.id === idValue);
    if (sourceIndex < 0) throw new Error("Stored skill not found");
    skills[sourceIndex] = normalizeStoredSkill(skills[sourceIndex]);
    const source = skills[sourceIndex];
    if (
      source.lifecycle !== "superseded" &&
      source.lifecycle !== "revoked"
    ) {
      throw new Error("Only a superseded or revoked skill can be rolled back");
    }
    const actions = resolveStoredSkillActions(source);
    const now = new Date().toISOString();
    const compilation: CompileResult = {
      ...source.compilation,
      runId: id("rollback"),
      createdAt: now,
      runtime: getRuntimeInfo(),
      parentRunId: source.compilation.runId,
      revision: (source.compilation.revision || 1) + 1
    };
    const verification = await verifyCompilation(compilation, actions);
    const compatibility = assessProofCompatibility({
      compilation,
      actions,
      verification,
      runtime: getRuntimeInfo()
    });
    if (
      verification.status !== "verified" ||
      compatibility.status !== "compatible"
    ) {
      throw new Error("Rollback verification failed");
    }
    const nextVersion =
      Math.max(
        0,
        ...skills
          .filter((skill) => skill.name === source.name)
          .map((skill) => skill.version)
      ) + 1;
    const replacementId = id("skill");
    for (let index = 0; index < skills.length; index += 1) {
      const current = normalizeStoredSkill(skills[index]);
      if (
        current.name === source.name &&
        current.lifecycle === "promoted"
      ) {
        skills[index] = {
          ...current,
          lifecycle: "superseded",
          supersededAt: now,
          supersededBySkillId: replacementId,
          updatedAt: now,
          governanceReceipts: [
            ...current.governanceReceipts,
            governanceReceipt({
              action: "SUPERSEDE",
              skillId: current.id,
              proofHash: proofHashFor(current),
              replacementSkillId: replacementId,
              reason: `Rollback restored ${source.name} v${source.version}`
            })
          ]
        };
      } else {
        skills[index] = current;
      }
    }
    const proofHash = String(verification.proofBundle.proofHash || "");
    const rolledBack: StoredSkill = {
      ...source,
      id: replacementId,
      version: nextVersion,
      lifecycle: "promoted",
      status: "verified",
      createdAt: now,
      updatedAt: now,
      reuseCount: 0,
      compilation,
      verification,
      actions,
      compatibility,
      governanceReceipts: [
        governanceReceipt({
          action: "ROLLBACK",
          skillId: replacementId,
          sourceSkillId: source.id,
          proofHash,
          reason
        })
      ],
      promotedAt: now,
      promotedProofHash: proofHash,
      revokedAt: undefined,
      revocationReason: undefined,
      supersededAt: undefined,
      supersededBySkillId: undefined,
      rollbackFromSkillId: source.id
    };
    skills.push(rolledBack);
    return structuredClone(rolledBack);
  });
}

export function resolveStoredSkillActions(
  skill: Pick<StoredSkill, "actions" | "compilation">
): ActionEvent[] {
  return skill.actions || inferLegacyActions(skill.compilation);
}

function inferLegacyActions(compilation: CompileResult): ActionEvent[] {
  return compilation.permissions
    .map((permission, index): ActionEvent | undefined => {
      const type = permissionToAction(permission.permission);
      return type
        ? {
            id: id("action"),
            type,
            label: `Legacy stored action: ${type}`,
            timestampMs: index * 1_000
          }
        : undefined;
    })
    .filter((action): action is ActionEvent => Boolean(action));
}

function normalizeStoredSkill(skill: StoredSkill): StoredSkill {
  return {
    ...skill,
    lifecycle:
      skill.lifecycle ||
      (skill.status === "verified" ? "promoted" : "candidate"),
    governanceReceipts: skill.governanceReceipts || []
  };
}

function proofHashFor(skill: StoredSkill): string {
  const proofHash = skill.verification.proofBundle.proofHash;
  if (typeof proofHash !== "string" || !proofHash) {
    throw new Error("Stored proof hash is missing");
  }
  return proofHash;
}

function governanceReceipt(input: Omit<SkillGovernanceReceipt, "receiptId" | "createdAt">): SkillGovernanceReceipt {
  return {
    ...input,
    receiptId: id("skill_receipt"),
    createdAt: new Date().toISOString()
  };
}

function permissionToAction(
  permission: string
): ActionEvent["type"] | undefined {
  if (permission.startsWith("filesystem:read")) return "open_document";
  if (permission === "mail:draft") return "draft_email";
  if (permission === "mail:send") return "send_email";
  if (permission === "calendar:draft") return "create_calendar_hold";
  if (permission.startsWith("filesystem:write")) return "write_report";
  return undefined;
}

function tokenize(value: string): string[] {
  const normalized = value.toLowerCase();
  const latin = normalized.match(/[a-z0-9_]+/g) || [];
  const chinese = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const chineseBigrams = chinese.flatMap((segment) =>
    Array.from({ length: Math.max(0, segment.length - 1) }, (_, index) =>
      segment.slice(index, index + 2)
    )
  );
  return [...new Set([...latin, ...chineseBigrams])];
}

function excerptFor(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  const positions = terms
    .map((term) => lower.indexOf(term))
    .filter((position) => position >= 0);
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 50);
  return content.slice(start, start + 240);
}

function roundDuration(value: number): number {
  return Math.max(0.01, Math.round(value * 100) / 100);
}

function roundRatio(value: number): number {
  return Math.round(value * 10) / 10;
}
