import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import {
  extractConstraintsDeterministically,
  inferPermissions,
  mergeModelConstraintsWithGuardrails
} from "./compiler.js";

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
});
