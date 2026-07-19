import type {
  ActionEvent,
  Constraint,
  Permission,
  SkillPromotionReview,
  StoredSkill
} from "../shared/types.js";
import { stableHash } from "./hash.js";

const decisionRank: Record<Permission["state"], number> = {
  deny: 0,
  review: 1,
  allow: 2
};

const severityRank = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
} as const;

export function buildPromotionReview(input: {
  candidate: StoredSkill;
  baseline?: StoredSkill;
  candidateActions: ActionEvent[];
  baselineActions?: ActionEvent[];
}): SkillPromotionReview {
  const candidateProofHash = proofHash(input.candidate);
  const baselineProofHash = input.baseline
    ? proofHash(input.baseline)
    : undefined;
  const permissionChanges = diffPermissions(
    input.baseline?.compilation.permissions || [],
    input.candidate.compilation.permissions
  );
  const constraintChanges = diffConstraints(
    input.baseline?.compilation.constraints || [],
    input.candidate.compilation.constraints
  );
  const actionChanges = diffActions(
    input.baselineActions || [],
    input.candidateActions
  );
  const runtimeChanged = Boolean(
    input.baseline &&
      stableHash(runtimeIdentity(input.baseline)) !==
        stableHash(runtimeIdentity(input.candidate))
  );
  const risks = [
    ...permissionRisks(permissionChanges),
    ...constraintRisks(constraintChanges),
    ...actionRisks(actionChanges)
  ];
  const riskLevel = risks.reduce<SkillPromotionReview["riskLevel"]>(
    (current, risk) =>
      severityRank[risk.severity] > severityRank[current]
        ? risk.severity
        : current,
    "low"
  );
  const core = {
    schemaVersion: "0.1.0" as const,
    skillId: input.candidate.id,
    name: input.candidate.name,
    candidateVersion: input.candidate.version,
    candidateProofHash,
    ...(input.baseline
      ? {
          baseline: {
            skillId: input.baseline.id,
            version: input.baseline.version,
            proofHash: baselineProofHash!
          }
        }
      : {}),
    changes: {
      permissions: permissionChanges,
      constraints: constraintChanges,
      actions: actionChanges,
      runtimeChanged
    },
    risks,
    riskLevel,
    requiresRiskAcknowledgement: risks.length > 0
  };
  return {
    ...core,
    reviewHash: stableHash(core)
  };
}

function diffPermissions(
  before: Permission[],
  after: Permission[]
): SkillPromotionReview["changes"]["permissions"] {
  const beforeMap = new Map(before.map((item) => [item.permission, item]));
  const afterMap = new Map(after.map((item) => [item.permission, item]));
  return [...new Set([...beforeMap.keys(), ...afterMap.keys()])]
    .sort()
    .flatMap((permission) => {
      const previous = beforeMap.get(permission)?.state;
      const next = afterMap.get(permission)?.state;
      if (previous === next) return [];
      return [
        {
          permission,
          change: !previous ? "added" : !next ? "removed" : "changed",
          ...(previous ? { before: previous } : {}),
          ...(next ? { after: next } : {})
        }
      ];
    });
}

function diffConstraints(
  before: Constraint[],
  after: Constraint[]
): SkillPromotionReview["changes"]["constraints"] {
  const beforeMap = new Map(
    before.map((item) => [constraintKey(item), item])
  );
  const afterMap = new Map(after.map((item) => [constraintKey(item), item]));
  return [...new Set([...beforeMap.keys(), ...afterMap.keys()])]
    .sort()
    .flatMap((key) => {
      if (beforeMap.has(key) && afterMap.has(key)) return [];
      const item = beforeMap.get(key) || afterMap.get(key)!;
      return [
        {
          kind: item.kind,
          statement: item.statement,
          change: beforeMap.has(key) ? "removed" : "added"
        }
      ];
    });
}

function diffActions(
  before: ActionEvent[],
  after: ActionEvent[]
): SkillPromotionReview["changes"]["actions"] {
  const beforeTypes = new Set(before.map((action) => action.type));
  const afterTypes = new Set(after.map((action) => action.type));
  return [...new Set([...beforeTypes, ...afterTypes])]
    .sort()
    .flatMap((type) => {
      if (beforeTypes.has(type) && afterTypes.has(type)) return [];
      return [
        {
          type,
          change: beforeTypes.has(type) ? "removed" : "added"
        }
      ];
    });
}

function permissionRisks(
  changes: SkillPromotionReview["changes"]["permissions"]
): SkillPromotionReview["risks"] {
  const risks: SkillPromotionReview["risks"] = [];
  for (const change of changes) {
    if (
      change.change === "removed" &&
      change.before === "deny"
    ) {
      risks.push({
        id: `permission-remove-deny:${change.permission}`,
        severity: "critical",
        category: "permission",
        message: `Removed explicit deny for ${change.permission}`
      });
      continue;
    }
    if (!change.after) continue;
    const beforeRank = change.before ? decisionRank[change.before] : 0;
    const afterRank = decisionRank[change.after];
    if (afterRank <= beforeRank) continue;
    const severity: SkillPromotionReview["riskLevel"] =
      change.after === "allow" && change.before === "deny"
        ? "critical"
        : change.after === "allow"
          ? "high"
          : "medium";
    risks.push({
      id: `permission-escalation:${change.permission}`,
      severity,
      category: "permission",
      message: `${change.permission} changed from ${
        change.before || "not granted"
      } to ${change.after}`
    });
  }
  return risks;
}

function constraintRisks(
  changes: SkillPromotionReview["changes"]["constraints"]
): SkillPromotionReview["risks"] {
  const risks: SkillPromotionReview["risks"] = [];
  for (const change of changes) {
    if (change.change !== "removed") continue;
    const critical =
      change.kind === "must_not" || change.kind === "redact";
    risks.push({
      id: `constraint-removed:${stableHash(change).slice(0, 12)}`,
      severity: critical ? "critical" : "high",
      category: "constraint",
      message: `Removed ${change.kind} guardrail: ${change.statement}`
    });
  }
  return risks;
}

function actionRisks(
  changes: SkillPromotionReview["changes"]["actions"]
): SkillPromotionReview["risks"] {
  const risks: SkillPromotionReview["risks"] = [];
  for (const change of changes) {
    if (change.change !== "added") continue;
    if (change.type === "send_email") {
      risks.push({
        id: "action-added:send_email",
        severity: "critical",
        category: "action",
        message: "Added irreversible send_email action"
      });
      continue;
    }
    if (
      change.type === "write_report" ||
      change.type === "create_calendar_hold"
    ) {
      risks.push({
        id: `action-added:${change.type}`,
        severity: "medium",
        category: "action",
        message: `Added state-changing ${change.type} action`
      });
    }
  }
  return risks;
}

function constraintKey(constraint: Constraint): string {
  return `${constraint.kind}:${constraint.statement
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()}`;
}

function runtimeIdentity(skill: StoredSkill) {
  const runtime = skill.compilation.runtime;
  return {
    mode: runtime.mode,
    model: runtime.model,
    asrModel: runtime.asrModel,
    gpu: runtime.gpu,
    rocm: runtime.rocm
  };
}

function proofHash(skill: StoredSkill): string {
  const value = skill.verification.proofBundle.proofHash;
  if (typeof value !== "string" || !value) {
    throw new Error("Stored proof hash is missing");
  }
  return value;
}
