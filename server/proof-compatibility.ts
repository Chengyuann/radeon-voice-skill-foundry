import type {
  ActionEvent,
  CompileResult,
  ProofCompatibility,
  ProofCompatibilityManifest,
  RuntimeInfo,
  VerifyResult
} from "../shared/types.js";
import { stableHash } from "./hash.js";

export const VERIFIER_VERSION = "rvsf-verifier-0.4.0";

export function createProofCompatibilityManifest(
  compilation: CompileResult,
  actions: ActionEvent[],
  runtime: RuntimeInfo = compilation.runtime
): ProofCompatibilityManifest {
  return {
    schemaVersion: "0.4.0",
    verifierVersion: VERIFIER_VERSION,
    runtimeHash: runtimeCompatibilityHash(runtime),
    toolContractHash: toolContractHash(actions),
    policyHash: stableHash(compilation.policyYaml),
    skillHash: stableHash(compilation.skillMarkdown),
    ...(compilation.voiceEvidence
      ? {
          voiceEvidenceSchemaVersion:
            compilation.voiceEvidence.schemaVersion
        }
      : {})
  };
}

export function assessProofCompatibility(input: {
  compilation: CompileResult;
  actions: ActionEvent[];
  verification: VerifyResult;
  runtime: RuntimeInfo;
}): ProofCompatibility {
  const expected = compatibilityFromProof(input.verification);
  const actual = createProofCompatibilityManifest(
    input.compilation,
    input.actions,
    input.runtime
  );
  const reasons: string[] = [];
  if (!expected) {
    reasons.push("Proof predates the compatibility manifest.");
  } else {
    compare(
      reasons,
      expected.verifierVersion,
      actual.verifierVersion,
      "Verifier version changed."
    );
    compare(
      reasons,
      expected.runtimeHash,
      actual.runtimeHash,
      "Model, GPU, ROCm, or runtime mode changed."
    );
    compare(
      reasons,
      expected.toolContractHash,
      actual.toolContractHash,
      "Tool contract changed."
    );
    compare(
      reasons,
      expected.policyHash,
      actual.policyHash,
      "Stored policy changed after verification."
    );
    compare(
      reasons,
      expected.skillHash,
      actual.skillHash,
      "Stored skill definition changed after verification."
    );
    compare(
      reasons,
      expected.voiceEvidenceSchemaVersion || "",
      actual.voiceEvidenceSchemaVersion || "",
      "Voice evidence schema changed."
    );
  }
  return {
    status: reasons.length ? "revalidation_required" : "compatible",
    reasons,
    checkedAt: new Date().toISOString(),
    ...(expected ? { expected } : {}),
    actual
  };
}

export function compatibilityFromProof(
  verification: VerifyResult
): ProofCompatibilityManifest | undefined {
  const compatibility = verification.proofBundle.compatibility;
  if (!compatibility || typeof compatibility !== "object") return undefined;
  return compatibility as ProofCompatibilityManifest;
}

export function toolContractHash(actions: ActionEvent[]): string {
  return stableHash(
    [...new Set(actions.map((action) => action.type))].sort()
  );
}

function runtimeCompatibilityHash(runtime: RuntimeInfo): string {
  return stableHash({
    mode: runtime.mode,
    model: runtime.model,
    asrModel: runtime.asrModel,
    gpu: runtime.gpu,
    rocm: runtime.rocm
  });
}

function compare(
  reasons: string[],
  expected: string,
  actual: string,
  message: string
): void {
  if (expected !== actual) reasons.push(message);
}
