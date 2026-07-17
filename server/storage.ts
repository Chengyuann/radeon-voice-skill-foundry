import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  KnowledgeDocument,
  KnowledgeMatch,
  SkillReuseResult,
  StoredSkill
} from "../shared/types.js";
import { id } from "./hash.js";

const dataDir = path.resolve(process.env.RVSF_DATA_DIR || ".rvsf-data");
const knowledgePath = path.join(dataDir, "knowledge.json");
const skillsPath = path.join(dataDir, "skills.json");

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
  return readJson(knowledgePath, seedDocuments);
}

export async function addKnowledge(
  input: Pick<KnowledgeDocument, "title" | "content">
): Promise<KnowledgeDocument> {
  const documents = await listKnowledge();
  const document: KnowledgeDocument = {
    id: id("doc"),
    title: input.title,
    content: input.content,
    createdAt: new Date().toISOString(),
    source: "user"
  };
  documents.push(document);
  await writeJson(knowledgePath, documents);
  return document;
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
  return readJson(skillsPath, []);
}

export async function saveVerifiedSkill(
  skill: Omit<StoredSkill, "id" | "version" | "createdAt" | "updatedAt" | "reuseCount">
): Promise<StoredSkill> {
  const skills = await listSkills();
  const current = skills
    .filter((item) => item.name === skill.name)
    .sort((a, b) => b.version - a.version)[0];
  const now = new Date().toISOString();
  const stored: StoredSkill = {
    ...skill,
    id: id("skill"),
    version: (current?.version || 0) + 1,
    createdAt: now,
    updatedAt: now,
    reuseCount: 0
  };
  skills.push(stored);
  await writeJson(skillsPath, skills);
  return stored;
}

export async function markSkillReused(
  idValue: string
): Promise<SkillReuseResult> {
  const startedAt = performance.now();
  const skills = await listSkills();
  const index = skills.findIndex((skill) => skill.id === idValue);
  if (index < 0) throw new Error("Stored skill not found");
  skills[index] = {
    ...skills[index],
    reuseCount: skills[index].reuseCount + 1,
    updatedAt: new Date().toISOString()
  };
  await writeJson(skillsPath, skills);
  const skill = skills[index];
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
      : {})
  };
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeJson(file, fallback);
    return structuredClone(fallback);
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, file);
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
