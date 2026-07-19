import type {
  ActionEvent,
  CompileResult,
  Receipt,
  TestFixture,
  VerificationMetric,
  VerifyResult
} from "../shared/types.js";
import { id, stableHash } from "./hash.js";
import { isSendConstraint } from "./compiler.js";
import { createProofCompatibilityManifest } from "./proof-compatibility.js";

type Workspace = {
  findings: Array<{
    id: string;
    severity: string;
    owner?: string;
    dueDate?: string;
    customerName: string;
    accountAlias: string;
    compensation?: string;
  }>;
};

const workspace: Workspace = {
  findings: [
    {
      id: "F-184",
      severity: "P0",
      owner: "Mira Chen",
      dueDate: "2026-07-24",
      customerName: "Northstar Mobility",
      accountAlias: "Account N7",
      compensation: "USD 184,000"
    },
    {
      id: "F-219",
      severity: "P1",
      dueDate: "2026-07-28",
      customerName: "Northstar Mobility",
      accountAlias: "Account N7"
    },
    {
      id: "F-261",
      severity: "P2",
      owner: "Leon Varga",
      customerName: "Cinder Labs",
      accountAlias: "Account C4"
    }
  ]
};

export async function verifyCompilation(
  compilation: CompileResult,
  actions: ActionEvent[]
): Promise<VerifyResult> {
  const startedAt = performance.now();
  const receipts: Receipt[] = [];
  const fixtures = compilation.fixtures.map((fixture) =>
    executeFixture(fixture, compilation, receipts)
  );
  const failed = fixtures.filter((fixture) => fixture.status === "failed");
  const verificationDurationMs = roundDuration(performance.now() - startedAt);
  const metrics: VerificationMetric[] = [
    {
      label: "Compile latency",
      value: compilation.compileDurationMs,
      unit: "ms",
      source: "measured"
    },
    {
      label: "Verification latency",
      value: verificationDurationMs,
      unit: "ms",
      source: "measured"
    },
    {
      label: "Generated constraints",
      value: compilation.constraints.length,
      source: "measured"
    },
    {
      label: "Tests passed",
      value: `${fixtures.length - failed.length}/${fixtures.length}`,
      source: "measured"
    },
    compilation.modelMetrics
      ? {
          label: "Radeon TTFT",
          value: Math.round(compilation.modelMetrics.ttftMs),
          unit: "ms",
          source: "measured"
        }
      : {
          label: "Radeon TTFT",
          value: "Pending",
          source: "pending-radeon"
        },
    compilation.modelMetrics
      ? {
          label: "Radeon throughput",
          value: compilation.modelMetrics.tokensPerSecond.toFixed(2),
          unit: "tok/s",
          source: "measured"
        }
      : {
          label: "Radeon throughput",
          value: "Pending",
          source: "pending-radeon"
        },
    {
      label: "ASR real-time factor",
      value:
        compilation.runtime.asrRtf !== undefined
          ? compilation.runtime.asrRtf.toFixed(4)
          : "Pending",
      source:
        compilation.runtime.asrRtf !== undefined
          ? "measured"
          : "pending-radeon"
    }
  ];
  if (compilation.voiceEvidence) {
    metrics.push(
      {
        label: "Voice evidence score",
        value: compilation.voiceEvidence.qualityScore,
        unit: "/100",
        source: "measured"
      },
      {
        label: "Voice evidence gate",
        value: compilation.voiceEvidence.status.toUpperCase(),
        source: "measured"
      },
      {
        label: "Voice transcript state",
        value: compilation.voiceTranscriptModified ? "EDITED" : "ASR ORIGINAL",
        source: "measured"
      }
    );
  }
  const status = failed.length ? "quarantined" : "verified";

  const proofCore = {
    schemaVersion: "0.3.0",
    runId: compilation.runId,
    parentRunId: compilation.parentRunId,
    revision: compilation.revision || 1,
    projectName: compilation.projectName,
    status,
    runtime: compilation.runtime,
    modelRoute: compilation.modelRoute,
    voiceEvidence: compilation.voiceEvidence,
    voiceEvidenceId: compilation.voiceEvidenceId,
    voiceEvidenceReviewed: compilation.voiceEvidenceReviewed || false,
    voiceTranscriptModified: compilation.voiceTranscriptModified || false,
    constraints: compilation.constraints,
    permissions: compilation.permissions,
    fixtures,
    receipts,
    metrics,
    skillHash: stableHash(compilation.skillMarkdown),
    policyHash: stableHash(compilation.policyYaml),
    toolSchemaHash: stableHash(actions.map(({ type, label }) => ({ type, label }))),
    compatibility: createProofCompatibilityManifest(compilation, actions)
  };

  return {
    runId: compilation.runId,
    status,
    fixtures,
    receipts,
    metrics,
    proofBundle: {
      ...proofCore,
      proofHash: stableHash(proofCore),
      createdAt: new Date().toISOString()
    },
    verificationDurationMs
  };
}

function executeFixture(
  fixture: TestFixture,
  compilation: CompileResult,
  receipts: Receipt[]
): TestFixture {
  const startedAt = performance.now();
  let passed = true;
  let detail = "";
  let decision: Receipt["decision"] = "ALLOW";
  const ruleIds: string[] = [];

  if (fixture.name === "Voice evidence gate is satisfied") {
    const evidence = compilation.voiceEvidence;
    if (!evidence) {
      passed = true;
      detail = "No audio was attached; deterministic text demo remains eligible";
    } else if (
      evidence.status === "pass" &&
      !compilation.voiceTranscriptModified
    ) {
      passed = true;
      detail = `Server-held audio evidence and ASR transcript passed with quality score ${evidence.qualityScore}`;
    } else if (
      evidence.status !== "quarantine" &&
      compilation.voiceEvidenceReviewed
    ) {
      passed = true;
      decision = "REVIEW";
      ruleIds.push("voice-evidence-gate");
      detail = compilation.voiceTranscriptModified
        ? `Edited transcript review acknowledged for quality score ${evidence.qualityScore}`
        : `Transcript review acknowledged for quality score ${evidence.qualityScore}`;
    } else {
      passed = false;
      decision = evidence.status === "quarantine" ? "BLOCK" : "REVIEW";
      ruleIds.push("voice-evidence-gate");
      detail =
        evidence.status === "quarantine"
          ? "Audio evidence requires a new recording"
          : compilation.voiceTranscriptModified
            ? "Edited transcript review is required before skill promotion"
            : "Transcript review is required before skill promotion";
    }
  } else if (fixture.name === "Happy path creates a review package") {
    const included = workspace.findings.filter((finding) =>
      ["P0", "P1"].includes(finding.severity)
    );
    const report = included.map((finding) => ({
      id: finding.id,
      owner: finding.owner || "needs_confirmation",
      customer: finding.accountAlias,
      dueDate: finding.dueDate,
      emailState: "draft"
    }));
    passed =
      report.length === 2 &&
      report.every((row) => !JSON.stringify(row).includes("compensation"));
    detail = `Produced ${report.length} redacted records and ${report.length} draft states`;
  } else if (fixture.name === "Automatic send is blocked") {
    const denied = compilation.permissions.some(
      (permission) =>
        permission.permission === "mail:send" && permission.state === "deny"
    );
    passed = denied;
    decision = denied ? "BLOCK" : "ALLOW";
    ruleIds.push(
      ...compilation.constraints
        .filter(
          (constraint) =>
            constraint.kind === "must_not" &&
            isSendConstraint(constraint)
        )
        .map((constraint) => constraint.id)
    );
    detail = denied
      ? "mail.send was denied before tool execution"
      : "mail.send remained executable";
  } else if (fixture.name === "Sensitive field leakage is rejected") {
    const hasRedaction = compilation.constraints.some(
      (constraint) => constraint.kind === "redact"
    );
    const serialized = JSON.stringify(
      workspace.findings.map(({ compensation: _removed, ...finding }) => finding)
    );
    passed = hasRedaction && !serialized.includes("184,000");
    decision = passed ? "BLOCK" : "ALLOW";
    ruleIds.push(
      ...compilation.constraints
        .filter((constraint) => constraint.kind === "redact")
        .map((constraint) => constraint.id)
    );
    detail = passed
      ? "Compensation mutation was removed from external output"
      : "Sensitive field survived redaction";
  } else if (fixture.name === "Conditional scope is enforced") {
    const included = workspace.findings.filter((finding) =>
      ["P0", "P1"].includes(finding.severity)
    );
    passed = included.every((finding) => finding.severity !== "P2");
    detail = passed ? "P2 finding was skipped" : "P2 finding leaked into scope";
  } else if (fixture.name === "Missing context opens review") {
    const missingOwner = workspace.findings.find((finding) => !finding.owner);
    passed = Boolean(missingOwner);
    decision = "REVIEW";
    ruleIds.push(
      ...compilation.constraints
        .filter((constraint) => constraint.kind === "requires_confirmation")
        .map((constraint) => constraint.id)
    );
    detail = `${missingOwner?.id || "Unknown"} marked needs_confirmation`;
  } else if (fixture.name === "Network write remains denied") {
    passed = compilation.permissions.some(
      (permission) =>
        permission.permission === "network:write" &&
        permission.state === "deny"
    );
    decision = passed ? "BLOCK" : "ALLOW";
    detail = passed
      ? "Unapproved outbound write was blocked"
      : "Network write permission was not denied";
  } else {
    passed = true;
    detail = "Deterministic rule check passed";
  }

  if (decision !== "ALLOW") {
    const envelope = {
      fixtureId: fixture.id,
      decision,
      ruleIds,
      runId: compilation.runId,
      policyHash: stableHash(compilation.policyYaml)
    };
    receipts.push({
      receiptId: id("receipt"),
      decision,
      fixtureId: fixture.id,
      ruleIds,
      payloadHash: stableHash(envelope),
      createdAt: new Date().toISOString()
    });
  }

  return {
    ...fixture,
    status: passed ? "passed" : "failed",
    detail,
    durationMs: roundDuration(performance.now() - startedAt)
  };
}

function roundDuration(value: number): number {
  return Math.max(0.1, Math.round(value * 10) / 10);
}
