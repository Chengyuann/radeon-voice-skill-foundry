import type {
  ActionEvent,
  CompileResult,
  Receipt,
  TestFixture,
  SandboxReplay,
  VerificationMetric,
  VerifyResult
} from "../shared/types.js";
import { id, stableHash } from "./hash.js";
import { isSendConstraint } from "./compiler.js";
import { createProofCompatibilityManifest } from "./proof-compatibility.js";
import { replaySandbox } from "./sandbox.js";

export async function verifyCompilation(
  compilation: CompileResult,
  actions: ActionEvent[]
): Promise<VerifyResult> {
  const startedAt = performance.now();
  const receipts: Receipt[] = [];
  const sandboxReplay = replaySandbox(compilation, actions);
  const fixtures = compilation.fixtures.map((fixture) =>
    executeFixture(fixture, compilation, sandboxReplay, receipts)
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
    {
      label: "Sandbox steps",
      value: `${
        sandboxReplay.steps.filter((step) => step.status === "passed").length
      }/${sandboxReplay.steps.length}`,
      source: "measured"
    },
    {
      label: "Adversarial probes",
      value: `${
        sandboxReplay.probes.filter((probe) => probe.passed).length
      }/${sandboxReplay.probes.length}`,
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
  const status =
    failed.length || sandboxReplay.status === "failed"
      ? "quarantined"
      : "verified";

  const proofCore = {
    schemaVersion: "0.4.0",
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
    sandboxReplay,
    skillHash: stableHash(compilation.skillMarkdown),
    policyHash: stableHash(compilation.policyYaml),
    toolSchemaHash: stableHash(actions.map(({ type, label }) => ({ type, label }))),
    actionContract: {
      sessionId: compilation.demonstrationSessionId,
      hash: stableHash(actions),
      eventCount: actions.length,
      events: actions
    },
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
  sandboxReplay: SandboxReplay,
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
    passed =
      sandboxReplay.status === "passed" &&
      sandboxReplay.summary.drafts === 2 &&
      sandboxReplay.summary.tentativeHolds === 2 &&
      sandboxReplay.summary.reportRecords === 2 &&
      sandboxReplay.summary.externalSideEffects === 0;
    detail = passed
      ? "Replay produced 2 drafts, 2 tentative holds, 2 redacted records, and 0 external side effects"
      : "Happy-path replay did not reach the expected final state";
  } else {
    const probe = sandboxReplay.probes.find(
      (item) => item.name === fixture.name
    );
    if (probe) {
      passed = probe.passed;
      decision = probe.decision;
      detail = probe.detail;
      if (fixture.name === "Automatic send is blocked") {
        ruleIds.push(
          ...compilation.constraints
            .filter(
              (constraint) =>
                constraint.kind === "must_not" &&
                isSendConstraint(constraint)
            )
            .map((constraint) => constraint.id)
        );
      } else if (fixture.name === "Sensitive field leakage is rejected") {
        ruleIds.push(
          ...compilation.constraints
            .filter((constraint) => constraint.kind === "redact")
            .map((constraint) => constraint.id)
        );
      } else if (fixture.name === "Missing context opens review") {
        ruleIds.push(
          ...compilation.constraints
            .filter(
              (constraint) =>
                constraint.kind === "requires_confirmation"
            )
            .map((constraint) => constraint.id)
        );
      }
    } else {
      passed = false;
      decision = "BLOCK";
      detail = "No sandbox probe was generated for this fixture";
    }
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
