import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import type { Constraint } from "../shared/types.js";
import {
  compileSop,
  extractConstraintsDeterministically,
  generateFixtures,
  inferPermissions,
  mergeModelConstraintsWithGuardrails,
  refineCompilation
} from "./compiler.js";
import { hydrateModelConstraints } from "./model-adapter.js";
import { evaluateModelAdmission } from "./model-adapter.js";

describe("SOP compiler", () => {
  it("extracts the critical spoken constraints", () => {
    const constraints = extractConstraintsDeterministically(
      reviewFollowupDemo.transcript,
      reviewFollowupDemo.actions
    );

    expect(
      constraints.some(
        (constraint) =>
          constraint.kind === "must_not" &&
          /send/i.test(constraint.statement)
      )
    ).toBe(true);
    expect(
      constraints.some((constraint) => constraint.kind === "redact")
    ).toBe(true);
    expect(
      constraints.some((constraint) => constraint.kind === "only_if")
    ).toBe(true);
  });

  it("denies send and arbitrary external capabilities", () => {
    const constraints = extractConstraintsDeterministically(
      reviewFollowupDemo.transcript,
      reviewFollowupDemo.actions
    );
    const permissions = inferPermissions(reviewFollowupDemo.actions, constraints);

    expect(
      permissions.find((permission) => permission.permission === "mail:send")
        ?.state
    ).toBe("deny");
    expect(
      permissions.find(
        (permission) => permission.permission === "desktop:control"
      )?.state
    ).toBe("deny");
  });

  it("keeps spoken safety guardrails when a model merges the rule", () => {
    const guardrails = extractConstraintsDeterministically(
      reviewFollowupDemo.transcript,
      reviewFollowupDemo.actions
    );
    const modelConstraints = [
      {
        id: "model-draft",
        kind: "must" as const,
        statement: "Draft emails must be generated; no automatic sending.",
        sourceText: "Draft emails only; do not send automatically.",
        confidence: 1,
        appliesTo: ["draft_email"]
      }
    ];
    const merged = mergeModelConstraintsWithGuardrails(
      modelConstraints,
      guardrails
    );

    expect(
      merged.some(
        (constraint) =>
          constraint.kind === "must_not" &&
          /send/i.test(constraint.statement)
      )
    ).toBe(true);
  });

  it("promotes Chinese no-send language to a must_not guardrail", () => {
    const merged = mergeModelConstraintsWithGuardrails(
      [
        {
          id: "model-cn-draft",
          kind: "must" as const,
          statement: "邮件必须生成草稿，不要自动发送。",
          sourceText: "邮件只能生成草稿，不要自动发送。",
          confidence: 1,
          appliesTo: ["draft_email"]
        }
      ],
      []
    );

    expect(
      merged.some(
        (constraint) =>
          constraint.kind === "must_not" &&
          /sending/i.test(constraint.statement)
      )
    ).toBe(true);
  });

  it("denies mail send and generates its fixture from Chinese ASR text", () => {
    const transcript =
      "邮件只能生成草稿，不要自动发送。如果负责人缺失，必须标记为需要确认。";
    const constraints = extractConstraintsDeterministically(
      transcript,
      reviewFollowupDemo.actions
    );
    const permissions = inferPermissions(reviewFollowupDemo.actions, constraints);
    const fixtures = generateFixtures(constraints, permissions);

    expect(
      constraints.some(
        (constraint) =>
          constraint.kind === "must_not" &&
          /automatic sending/i.test(constraint.statement)
      )
    ).toBe(true);
    expect(
      permissions.find((permission) => permission.permission === "mail:send")
        ?.state
    ).toBe("deny");
    expect(
      fixtures.some((fixture) => fixture.name === "Automatic send is blocked")
    ).toBe(true);
  });

  it("preserves Chinese redaction, confirmation, and date conditions", () => {
    const transcript =
      "项目评审之后，只处理P零和P一问题。外部报告里不能包含薪资数据。" +
      "邮件只能生成草稿，不要自动发送。如果负责人缺失，必须标记为需要确认。" +
      "只有存在截止日期时，才创建日历站位。";
    const guardrails = extractConstraintsDeterministically(
      transcript,
      reviewFollowupDemo.actions
    );
    const merged = mergeModelConstraintsWithGuardrails(
      [
        {
          id: "model-cn-summary",
          kind: "must" as const,
          statement: "Draft owner follow-up emails.",
          sourceText: "邮件只能生成草稿。",
          confidence: 0.9,
          appliesTo: ["draft_email"]
        }
      ],
      guardrails
    );

    expect(
      merged.some(
        (constraint) =>
          constraint.kind === "redact" &&
          /薪资数据/.test(constraint.statement)
      )
    ).toBe(true);
    expect(
      merged.some(
        (constraint) =>
          constraint.kind === "requires_confirmation" &&
          /负责人/.test(constraint.statement)
      )
    ).toBe(true);
    expect(
      merged.some(
        (constraint) =>
          constraint.kind === "only_if" &&
          /截止日期/.test(constraint.statement)
      )
    ).toBe(true);

    const compilationFixtures = generateFixturesForTest(merged);
    expect(
      compilationFixtures.some(
        (fixture) => fixture.name === "Conditional scope is enforced"
      )
    ).toBe(true);
  });

  it("hydrates compact model rules with runtime-owned metadata", () => {
    const constraints = hydrateModelConstraints([
      {
        kind: "redact",
        statement: "Remove compensation data",
        sourceText: "Do not include compensation data",
        appliesTo: ["write_report"]
      }
    ]);

    expect(constraints[0].id).toMatch(/^rule_/);
    expect(constraints[0].confidence).toBe(0.92);
    expect(constraints[0].statement).toBe("Remove compensation data");
  });

  it("accepts model constraints with an omitted action scope", () => {
    const constraints = hydrateModelConstraints(
      [
        {
          kind: "must_not",
          statement: "Do not send email automatically",
          sourceText: "Only create a draft"
        }
      ],
      reviewFollowupDemo.actions
    );

    expect(constraints[0].appliesTo).toEqual(["open_document"]);
  });

  it("rejects a model candidate that omits required safety kinds", () => {
    const guardrails = extractConstraintsDeterministically(
      reviewFollowupDemo.transcript,
      reviewFollowupDemo.actions
    );
    const candidate = hydrateModelConstraints(
      [
        {
          kind: "redact",
          statement: "Remove compensation data",
          sourceText: "Never include compensation data",
          appliesTo: ["write_report"]
        }
      ],
      reviewFollowupDemo.actions
    );
    const admission = evaluateModelAdmission(candidate, guardrails);
    expect(admission.accepted).toBe(false);
    expect(admission.reasons).toContain("missing_must_not");
    expect(admission.reasons).toContain("missing_only_if");
    expect(admission.reasons).toContain("missing_requires_confirmation");
  });

  it("accepts a model candidate that covers every required safety kind", () => {
    const guardrails = extractConstraintsDeterministically(
      reviewFollowupDemo.transcript,
      reviewFollowupDemo.actions
    );
    const candidate = guardrails.map((constraint) => ({ ...constraint }));
    expect(evaluateModelAdmission(candidate, guardrails)).toEqual({
      accepted: true,
      reasons: []
    });
  });

  it("attaches RAG evidence and increments revisions", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const refined = await refineCompilation({
      compilation,
      message: "Always require confirmation before calendar holds.",
      actions: reviewFollowupDemo.actions,
      priorVerificationStatus: "verified"
    });

    expect(compilation.ragMatches?.length).toBeGreaterThan(0);
    expect(refined.revision).toBe(2);
    expect(refined.parentRunId).toBe(compilation.runId);
    expect(refined.revisionHistory).toHaveLength(2);
    expect(refined.revisionHistory?.[0]).toMatchObject({
      revision: 1,
      runId: compilation.runId,
      status: "verified"
    });
    expect(refined.revisionHistory?.[1]).toMatchObject({
      revision: 2,
      runId: refined.runId,
      parentRunId: compilation.runId,
      instruction: "Always require confirmation before calendar holds.",
      status: "compiled",
      fixtureCount: refined.fixtures.length
    });
    expect(
      refined.revisionHistory?.[1].addedConstraints.some((statement) =>
        /calendar holds/i.test(statement)
      )
    ).toBe(true);
    expect(
      refined.constraints.some(
        (constraint) =>
          constraint.kind === "requires_confirmation" &&
          /calendar holds/i.test(constraint.statement)
      )
    ).toBe(true);
    expect(
      refined.constraints.every(
        (constraint) =>
          !constraint.statement.includes("[existing") &&
          !constraint.sourceText.includes("\n")
      )
    ).toBe(true);
  });
});

function generateFixturesForTest(constraints: Constraint[]) {
  const permissions = inferPermissions(reviewFollowupDemo.actions, constraints);
  return generateFixtures(constraints, permissions, {
    schemaVersion: "0.1.0",
    status: "pass",
    qualityScore: 100,
    format: "PCM 16-bit WAV",
    audioSha256: "a".repeat(64),
    issues: [],
    analyzedAt: "2026-07-18T00:00:00.000Z"
  });
}
