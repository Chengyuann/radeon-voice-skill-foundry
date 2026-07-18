import type {
  ActionEvent,
  CompileRequest,
  CompileResult,
  Constraint,
  ConstraintKind,
  Permission,
  TestFixture,
  VoiceEvidence
} from "../shared/types.js";
import { id } from "./hash.js";
import { extractConstraintsWithModel } from "./model-adapter.js";
import { getRuntimeInfo } from "./runtime.js";
import { searchKnowledge } from "./storage.js";

type Pattern = {
  kind: ConstraintKind;
  regex: RegExp;
  statement: (match: RegExpMatchArray) => string;
  appliesTo: string[];
  confidence: number;
};

type TrustedCompileRequest = CompileRequest & {
  voiceEvidence?: VoiceEvidence;
  voiceTranscriptModified?: boolean;
};

const patterns: Pattern[] = [
  {
    kind: "requires_confirmation",
    regex:
      /\b(?:always\s+)?(?:ask|require)\s+(?:me\s+)?(?:for\s+)?(?:confirmation|approval)?\s*before\s+([^\n.]+)/gi,
    statement: (match) =>
      `Require human confirmation before ${clean(match[1])}`,
    appliesTo: ["draft_email", "send_email", "create_calendar_hold"],
    confidence: 0.97
  },
  {
    kind: "must_not",
    regex:
      /\b(?:do not|don't|never)\s+(send[^\n.]*automatically|send[^\n.]*|delete[^\n.]*)/gi,
    statement: (match) => `Prohibit: ${clean(match[1])}`,
    appliesTo: ["send_email", "draft_email"],
    confidence: 0.98
  },
  {
    kind: "must_not",
    regex:
      /(?:不要|不得|不能|禁止|不应)(?:再|进行)?(?:自动)?(?:发送|发出|投递)([^。！？\n]*)/g,
    statement: (match) =>
      `Prohibit automatic sending${clean(match[1]) ? `: ${clean(match[1])}` : ""}`,
    appliesTo: ["send_email", "draft_email"],
    confidence: 0.99
  },
  {
    kind: "redact",
    regex:
      /\b(?:never include|redact|remove)\s+([^\n.]*(?:data|information|name)[^\n.]*)/gi,
    statement: (match) => `Redact ${clean(match[1])}`,
    appliesTo: ["write_report", "draft_email"],
    confidence: 0.97
  },
  {
    kind: "redact",
    regex:
      /(?:不能|不得|不要|禁止)(?:在[^。！？\n]{0,30})?(?:包含|写入|暴露)([^。！？\n]*(?:数据|信息|姓名|名称)[^。！？\n]*)/g,
    statement: (match) => `Redact ${clean(match[1])}`,
    appliesTo: ["write_report", "draft_email"],
    confidence: 0.98
  },
  {
    kind: "only_if",
    regex: /\bonly (?:include|process|keep)\s+([^\n.]+)/gi,
    statement: (match) => `Only include ${clean(match[1])}`,
    appliesTo: ["filter_findings", "write_report"],
    confidence: 0.96
  },
  {
    kind: "requires_confirmation",
    regex:
      /\bif\s+([^\n,]+),\s*(?:mark|set)\s+([^\n.]*(?:confirmation|confirm)[^\n.]*)/gi,
    statement: (match) =>
      `When ${clean(match[1])}, require ${clean(match[2])}`,
    appliesTo: ["select_commitment", "draft_email"],
    confidence: 0.93
  },
  {
    kind: "requires_confirmation",
    regex:
      /如果([^。！？\n，,]+)(?:缺失|不存在|没有)[^。！？\n，,]*[，,]?\s*(?:必须|需要)(?:标记为|设为|进入)([^。！？\n]*(?:确认|复核)[^。！？\n]*)/g,
    statement: (match) =>
      `When ${clean(match[1])} is missing, require ${clean(match[2])}`,
    appliesTo: ["select_commitment", "draft_email"],
    confidence: 0.98
  },
  {
    kind: "only_if",
    regex: /\bonly when\s+([^\n.]+)/gi,
    statement: (match) => `Execute only when ${clean(match[1])}`,
    appliesTo: ["create_calendar_hold"],
    confidence: 0.94
  },
  {
    kind: "only_if",
    regex:
      /只有([^。！？\n，,]+)(?:时|的时候)[，,]?\s*(?:才)?([^。！？\n]*(?:创建|生成|执行)[^。！？\n]*)/g,
    statement: (match) =>
      `Execute ${clean(match[2])} only when ${clean(match[1])}`,
    appliesTo: ["create_calendar_hold"],
    confidence: 0.98
  },
  {
    kind: "must",
    regex: /\breplace\s+([^\n.]*)\s+before\s+([^\n.]+)/gi,
    statement: (match) =>
      `Replace ${clean(match[1])} before ${clean(match[2])}`,
    appliesTo: ["write_report"],
    confidence: 0.94
  },
  {
    kind: "must",
    regex: /\b(?:draft|create|write)\s+([^\n.]+)/gi,
    statement: (match) => `Produce ${clean(match[1])}`,
    appliesTo: ["draft_email", "create_calendar_hold", "write_report"],
    confidence: 0.76
  }
];

export async function compileSop(
  input: TrustedCompileRequest
): Promise<CompileResult> {
  const startedAt = performance.now();
  let constraints: Constraint[] | null = null;
  let modelMetrics: CompileResult["modelMetrics"];
  const ragMatches = await searchKnowledge(
    `${input.scenario}\n${input.transcript}`,
    4
  );
  const ragContext = ragMatches
    .map((match) => `${match.title}: ${match.excerpt}`)
    .join("\n");

  if (input.useModel) {
    const extraction = await extractConstraintsWithModel({
      ...input,
      ragContext
    });
    constraints = extraction
      ? mergeModelConstraintsWithGuardrails(
          extraction.constraints,
          extractConstraintsDeterministically(input.transcript, input.actions)
        )
      : null;
    modelMetrics = extraction?.metrics;
  }
  constraints ??= extractConstraintsDeterministically(
    input.transcript,
    input.actions
  );

  const permissions = inferPermissions(
    input.actions,
    constraints,
    input.voiceEvidence,
    input.voiceTranscriptModified,
    input.voiceEvidenceReviewed
  );
  const fixtures = generateFixtures(
    constraints,
    permissions,
    input.voiceEvidence
  );
  const runId = id("run");
  const runtime = getRuntimeInfo();

  return {
    runId,
    createdAt: new Date().toISOString(),
    projectName: input.projectName,
    scenario: input.scenario,
    constraints,
    permissions,
    fixtures,
    skillMarkdown: renderSkillMarkdown(input, constraints, permissions),
    policyYaml: renderPolicyYaml(constraints, permissions),
    compileDurationMs: roundDuration(performance.now() - startedAt),
    runtime,
    ragMatches,
    ...(input.voiceEvidence ? { voiceEvidence: input.voiceEvidence } : {}),
    ...(input.voiceEvidenceId
      ? { voiceEvidenceId: input.voiceEvidenceId }
      : {}),
    ...(input.voiceEvidenceReviewed
      ? { voiceEvidenceReviewed: input.voiceEvidenceReviewed }
      : {}),
    ...(input.voiceTranscriptModified
      ? { voiceTranscriptModified: input.voiceTranscriptModified }
      : {}),
    revision: 1,
    ...(modelMetrics ? { modelMetrics } : {})
  };
}

export async function refineCompilation(
  input: {
    compilation: CompileResult;
    message: string;
    actions: ActionEvent[];
    useModel?: boolean;
  }
): Promise<CompileResult> {
  const prior = input.compilation;
  const combinedTranscript = [
    prior.constraints
      .map(
        (constraint) =>
          `[existing ${constraint.kind}] ${constraint.statement}`
      )
      .join("\n"),
    `[user revision] ${input.message}`
  ].join("\n");
  const refined = await compileSop({
    projectName: prior.projectName,
    scenario: prior.scenario,
    transcript: combinedTranscript,
    actions: input.actions,
    useModel: input.useModel,
    voiceEvidenceId: prior.voiceEvidenceId,
    voiceEvidence: prior.voiceEvidence,
    voiceEvidenceReviewed: prior.voiceEvidenceReviewed,
    voiceTranscriptModified: prior.voiceTranscriptModified
  });
  return {
    ...refined,
    parentRunId: prior.runId,
    revision: (prior.revision || 1) + 1
  };
}

export function mergeModelConstraintsWithGuardrails(
  modelConstraints: Constraint[],
  guardrails: Constraint[]
): Constraint[] {
  const merged: Constraint[] = [];
  const normalizedModelConstraints = modelConstraints.flatMap((constraint) => {
    const text = `${constraint.sourceText} ${constraint.statement}`;
    const additions: Constraint[] = [constraint];
    if (
      constraint.kind !== "must_not" &&
      /(不要|不得|不能|禁止|不应|never|do not|don't|must not).{0,30}(send|发送|自动发送)|(?:send|发送|自动发送).{0,30}(不要|不得|不能|禁止|不应|never|do not|don't|must not)/i.test(
        text
      )
    ) {
      additions.unshift({
        ...constraint,
        id: `${constraint.id}-safety-deny`,
        kind: "must_not",
        statement: "Prohibit automatic sending",
        confidence: Math.max(constraint.confidence, 0.99)
      });
    }
    return additions;
  });
  const safetyGuardrails = guardrails.filter((constraint) =>
    ["must_not", "redact", "only_if", "requires_confirmation"].includes(
      constraint.kind
    )
  );

  for (const constraint of [
    ...safetyGuardrails,
    ...normalizedModelConstraints
  ]) {
    const sourceKey = normalizeConstraintText(constraint.sourceText);
    const statementKey = normalizeConstraintText(constraint.statement);

    const sensitiveExclusionAlreadyRedacted =
      constraint.kind === "must_not" &&
      /(data|information|identifier|compensation|financial|report)/i.test(
        `${constraint.sourceText} ${constraint.statement}`
      ) &&
      merged.some(
        (existing) =>
          existing.kind === "redact" &&
          normalizeConstraintText(existing.sourceText) === sourceKey
      );
    if (sensitiveExclusionAlreadyRedacted) continue;

    const duplicate = merged.some(
      (existing) =>
        existing.kind === constraint.kind &&
        (normalizeConstraintText(existing.sourceText) === sourceKey ||
          normalizeConstraintText(existing.statement) === statementKey)
    );
    if (!duplicate) merged.push(constraint);
  }

  return merged.slice(0, 20);
}

export function extractConstraintsDeterministically(
  transcript: string,
  actions: ActionEvent[]
): Constraint[] {
  const constraints: Constraint[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    for (const match of transcript.matchAll(pattern.regex)) {
      const statement = pattern.statement(match);
      const key = `${pattern.kind}:${statement.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      constraints.push({
        id: id("rule"),
        kind: pattern.kind,
        statement,
        sourceText: match[0].trim(),
        confidence: pattern.confidence,
        appliesTo: alignToAvailableActions(pattern.appliesTo, actions)
      });
    }
  }

  if (!constraints.some((constraint) => constraint.kind === "must_not")) {
    constraints.push({
      id: id("rule"),
      kind: "requires_confirmation",
      statement: "Require confirmation before irreversible external actions",
      sourceText: "Safety baseline",
      confidence: 1,
      appliesTo: ["send_email"]
    });
  }

  return constraints.slice(0, 16);
}

export function inferPermissions(
  actions: ActionEvent[],
  constraints: Constraint[],
  voiceEvidence?: VoiceEvidence,
  voiceTranscriptModified = false,
  voiceEvidenceReviewed = false
): Permission[] {
  const permissions = new Map<string, Permission>();

  const add = (
    permission: string,
    state: Permission["state"],
    reason: string
  ) => {
    permissions.set(permission, {
      id: id("perm"),
      permission,
      state,
      reason
    });
  };

  for (const action of actions) {
    switch (action.type) {
      case "open_document":
      case "filter_findings":
      case "select_commitment":
        add("filesystem:read:workspace/**", "allow", action.label);
        break;
      case "draft_email":
        add("mail:draft", "allow", action.label);
        break;
      case "send_email":
        add("mail:send", "review", "External side effect");
        break;
      case "create_calendar_hold":
        add("calendar:draft", "allow", action.label);
        break;
      case "write_report":
        add(
          "filesystem:write:workspace/reports/**",
          "allow",
          action.label
        );
        break;
    }
  }

  const prohibitSend = constraints.some(
    (constraint) =>
      constraint.kind === "must_not" &&
      isSendConstraint(constraint)
  );
  if (prohibitSend) {
    add("mail:send", "deny", "Spoken SOP prohibits automatic sending");
  } else if (!permissions.has("mail:send")) {
    add(
      "mail:send",
      "review",
      "Not observed in the demonstration; explicit review required"
    );
  }

  add("desktop:control", "deny", "Arbitrary desktop control is outside MVP");
  add("network:write", "deny", "Local-first proof path");
  if (voiceEvidence) {
    const needsReview =
      voiceEvidence.status === "review" || voiceTranscriptModified;
    add(
      "voice:evidence",
      voiceEvidence.status === "quarantine"
        ? "deny"
        : needsReview && !voiceEvidenceReviewed
          ? "review"
          : "allow",
      voiceEvidence.status === "quarantine"
        ? "Audio evidence requires a new recording"
        : needsReview
          ? "Transcript review is bound to the voice-seeded skill"
          : "Server-held audio evidence matches the ASR transcript"
    );
  }

  return [...permissions.values()];
}

export function generateFixtures(
  constraints: Constraint[],
  permissions: Permission[],
  voiceEvidence?: VoiceEvidence
): TestFixture[] {
  const fixtures: TestFixture[] = [
    {
      id: id("test"),
      name: "Happy path creates a review package",
      intent: "Execute the demonstrated workflow on valid P0/P1 findings",
      expected: "Drafts, tentative holds, and a redacted report are produced",
      severity: "high"
    }
  ];

  if (voiceEvidence) {
    fixtures.unshift({
      id: id("test"),
      name: "Voice evidence gate is satisfied",
      intent: "Promote a skill compiled from measured audio evidence",
      expected:
        "Audio passes locally or a review-quality transcript is acknowledged",
      severity: "critical"
    });
  }

  for (const constraint of constraints) {
    if (
      constraint.kind === "must_not" &&
      isSendConstraint(constraint)
    ) {
      fixtures.push({
        id: id("test"),
        name: "Automatic send is blocked",
        intent: "Attempt to call mail.send after creating a draft",
        expected: "Governance returns BLOCK and writes a receipt",
        severity: "critical"
      });
    }
    if (constraint.kind === "redact") {
      fixtures.push({
        id: id("test"),
        name: "Sensitive field leakage is rejected",
        intent: "Include compensation data in the external report",
        expected: "Sensitive field is absent and the mutation test passes",
        severity: "critical"
      });
    }
    if (constraint.kind === "only_if") {
      fixtures.push({
        id: id("test"),
        name: "Conditional scope is enforced",
        intent: `Run outside condition: ${constraint.statement}`,
        expected: "Out-of-scope record is skipped",
        severity: "high"
      });
    }
    if (constraint.kind === "requires_confirmation") {
      fixtures.push({
        id: id("test"),
        name: "Missing context opens review",
        intent: constraint.statement,
        expected: "Governance returns REVIEW and no external action executes",
        severity: "high"
      });
    }
  }

  if (permissions.some((permission) => permission.permission === "network:write")) {
    fixtures.push({
      id: id("test"),
      name: "Network write remains denied",
      intent: "Attempt an unapproved outbound write",
      expected: "Governance returns BLOCK",
      severity: "critical"
    });
  }

  return dedupeFixtures(fixtures).slice(0, 8);
}

function renderSkillMarkdown(
  input: CompileRequest,
  constraints: Constraint[],
  permissions: Permission[]
): string {
  const name = slugify(input.projectName);
  const permissionLines = permissions
    .filter((permission) => permission.state === "allow")
    .map((permission) => `      - ${permission.permission}`)
    .join("\n");
  const actionLines = input.actions
    .map((action, index) => `${index + 1}. ${action.label}`)
    .join("\n");
  const constraintLines = constraints
    .map((constraint) => `- [${constraint.kind}] ${constraint.statement}`)
    .join("\n");

  return `---
name: ${name}
description: ${input.scenario}
license: MIT
version: 0.1.0
metadata:
  gaia:
    security_tier: experimental
    permissions:
${permissionLines || "      []"}
    tools_required:
      - read_file
      - remember
---

# ${titleCase(name)}

## Procedure
${actionLines}

## Spoken SOP constraints
${constraintLines}

## Promotion rule
Keep this skill experimental until all generated fixtures pass and the proof
bundle matches the current model, tool schema, policy, and skill version.
`;
}

function renderPolicyYaml(
  constraints: Constraint[],
  permissions: Permission[]
): string {
  const lines = [
    "version: v0.1.0",
    "default: REVIEW",
    "permissions:"
  ];
  for (const permission of permissions) {
    lines.push(`  - capability: ${permission.permission}`);
    lines.push(`    decision: ${permission.state.toUpperCase()}`);
    lines.push(`    reason: "${escapeYaml(permission.reason)}"`);
  }
  lines.push("constraints:");
  for (const constraint of constraints) {
    lines.push(`  - id: ${constraint.id}`);
    lines.push(`    kind: ${constraint.kind}`);
    lines.push(`    statement: "${escapeYaml(constraint.statement)}"`);
  }
  return `${lines.join("\n")}\n`;
}

function alignToAvailableActions(
  suggested: string[],
  actions: ActionEvent[]
): string[] {
  const available = new Set(actions.map((action) => action.type));
  const aligned = suggested.filter((type) => available.has(type as ActionEvent["type"]));
  return aligned.length ? aligned : actions.slice(0, 1).map((action) => action.type);
}

function dedupeFixtures(fixtures: TestFixture[]): TestFixture[] {
  const seen = new Set<string>();
  return fixtures.filter((fixture) => {
    if (seen.has(fixture.name)) return false;
    seen.add(fixture.name);
    return true;
  });
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/[,.]+$/, "");
}

function normalizeConstraintText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

export function isSendConstraint(constraint: Constraint): boolean {
  return /\b(?:send|sends|sending|sent)\b|发送|发出|投递/i.test(
    `${constraint.statement} ${constraint.sourceText}`
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "voice-sop-skill"
  );
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeYaml(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function roundDuration(value: number): number {
  return Math.max(1, Math.round(value * 10) / 10);
}
