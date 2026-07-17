import type {
  ActionEvent,
  CompileResult,
  KnowledgeDocument,
  KnowledgeMatch,
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
      const actions = skills[index].actions || inferLegacyActions(skills[index]);
      const compatibility = assessProofCompatibility({
        compilation: skills[index].compilation,
        actions,
        verification: skills[index].verification,
        runtime: getRuntimeInfo()
      });
      skills[index] = {
        ...skills[index],
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
    const actions = skills[index].actions || inferLegacyActions(skills[index]);
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
    const actions = skills[index].actions || inferLegacyActions(skills[index]);
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
      updatedAt: now
    };
    return {
      skill: structuredClone(skills[index]),
      verification: structuredClone(verification),
      compatibility
    };
  });
}

function inferLegacyActions(skill: StoredSkill): ActionEvent[] {
  return skill.compilation.permissions
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
