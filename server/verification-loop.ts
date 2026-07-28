import type {
  CompileResult,
  VerificationRepairAttempt,
  VerificationRepairResult,
  VerifyResult
} from "../shared/types.js";
import { MAX_AUTO_REPAIR_ATTEMPTS } from "./agent-contracts.js";
import { refineCompilation } from "./compiler.js";
import {
  storeCompileRun,
  storeVerificationRun,
  type TrustedCompileRun
} from "./runtime-store.js";
import { verifyCompilation } from "./verifier.js";

export async function verifyAndStoreTrustedRun(
  trustedRun: TrustedCompileRun
): Promise<{
  compilation: CompileResult;
  verification: VerifyResult;
}> {
  const verification = await verifyCompilation(
    trustedRun.compilation,
    trustedRun.actions
  );
  const compilation = compilationWithVerificationStatus(
    trustedRun.compilation,
    verification
  );
  await storeCompileRun(compilation, trustedRun.actions);
  await storeVerificationRun({
    compilation,
    actions: trustedRun.actions,
    verification
  });
  return { compilation, verification };
}

export async function runVerificationRepairLoop(input: {
  trustedRun: TrustedCompileRun;
  maxAttempts?: number;
  useModel?: boolean;
}): Promise<VerificationRepairResult> {
  const maxAttempts = Math.min(
    MAX_AUTO_REPAIR_ATTEMPTS,
    Math.max(1, input.maxAttempts || MAX_AUTO_REPAIR_ATTEMPTS)
  );
  const attempts: VerificationRepairAttempt[] = [];
  let currentRun = input.trustedRun;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const checked = await verifyAndStoreTrustedRun(currentRun);
    attempts.push({
      attempt,
      runId: checked.compilation.runId,
      revision: checked.compilation.revision || 1,
      status: checked.verification.status,
      findings: checked.verification.feedback?.findings || [],
      repairInstruction:
        checked.verification.feedback?.repairInstruction
    });
    if (checked.verification.status === "verified") {
      return {
        initialRunId: input.trustedRun.runId,
        finalCompilation: checked.compilation,
        finalVerification: checked.verification,
        attempts,
        exhausted: false,
        stoppedReason: "verified"
      };
    }

    const feedback = checked.verification.feedback;
    if (!feedback?.autoRepairEligible || !feedback.repairInstruction) {
      return {
        initialRunId: input.trustedRun.runId,
        finalCompilation: checked.compilation,
        finalVerification: checked.verification,
        attempts,
        exhausted: false,
        stoppedReason: "manual_intervention_required"
      };
    }
    if (attempt === maxAttempts) {
      return {
        initialRunId: input.trustedRun.runId,
        finalCompilation: checked.compilation,
        finalVerification: checked.verification,
        attempts,
        exhausted: true,
        stoppedReason: "repair_budget_exhausted"
      };
    }

    const refined = await refineCompilation({
      compilation: checked.compilation,
      message: feedback.repairInstruction,
      actions: currentRun.actions,
      useModel: input.useModel,
      priorVerificationStatus: checked.verification.status,
      revisionSource: "verifier",
      findingIds: feedback.findings.map((finding) => finding.id)
    });
    await storeCompileRun(refined, currentRun.actions);
    currentRun = {
      runId: refined.runId,
      compilation: refined,
      actions: currentRun.actions,
      storedAt: new Date().toISOString()
    };
  }

  throw new Error("Verification repair loop ended unexpectedly");
}

function compilationWithVerificationStatus(
  compilation: CompileResult,
  verification: VerifyResult
): CompileResult {
  return {
    ...compilation,
    ...(compilation.revisionHistory
      ? {
          revisionHistory: compilation.revisionHistory.map((turn) =>
            turn.runId === compilation.runId
              ? { ...turn, status: verification.status }
              : turn
          )
        }
      : {})
  };
}
