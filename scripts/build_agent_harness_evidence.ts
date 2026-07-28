import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { reviewFollowupDemo } from "../shared/demo.js";

const root = process.cwd();
const submission = path.join(root, "submission");
const stateDir = path.join(root, "tmp", "agent-harness-evidence-state");
const evidencePath = path.join(
  submission,
  "AGENT_HARNESS_REPAIR_EVIDENCE.json"
);
const proofPath = path.join(
  submission,
  "AGENT_HARNESS_REPAIR_PROOF.zip"
);

await rm(stateDir, { recursive: true, force: true });
await mkdir(stateDir, { recursive: true });
process.env.RVSF_DATA_DIR = stateDir;

const [{ compileSop }, { buildSubmissionPackage }, { storeCompileRun }, loop] =
  await Promise.all([
    import("../server/compiler.js"),
    import("../server/package.js"),
    import("../server/runtime-store.js"),
    import("../server/verification-loop.js")
  ]);

const compilation = await compileSop(reviewFollowupDemo);
const unsafeCompilation = {
  ...compilation,
  permissions: compilation.permissions.map((permission) =>
    permission.permission === "mail:send"
      ? {
          ...permission,
          state: "allow" as const,
          reason: "Injected evidence failure: unsafe external send"
        }
      : permission
  )
};
const trustedRun = await storeCompileRun(
  unsafeCompilation,
  reviewFollowupDemo.actions
);
const result = await loop.runVerificationRepairLoop({
  trustedRun,
  maxAttempts: 2,
  useModel: false
});

if (
  result.stoppedReason !== "verified" ||
  result.attempts.length !== 2 ||
  result.attempts[0].status !== "quarantined" ||
  result.finalVerification.status !== "verified"
) {
  throw new Error("Bounded repair evidence did not complete as expected");
}

const archive = await buildSubmissionPackage(
  result.finalCompilation,
  result.finalVerification
);
const zip = await JSZip.loadAsync(archive);
const folder =
  zip.folder(result.finalCompilation.projectName) ??
  zip.folder("agent-harness-repair") ??
  zip;
folder.file("repair_cycle.json", JSON.stringify(result, null, 2));

const proof = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 }
});
await writeFile(proofPath, proof);

const proofBundle = result.finalVerification.proofBundle;
const evidence = {
  schemaVersion: "0.1.0",
  generatedAt: new Date().toISOString(),
  scenario: "Server-authoritative bounded verifier repair",
  injectedFailure: {
    permission: "mail:send",
    unsafeState: "allow"
  },
  initialRunId: result.initialRunId,
  finalRunId: result.finalCompilation.runId,
  finalRevision: result.finalCompilation.revision,
  stoppedReason: result.stoppedReason,
  exhausted: result.exhausted,
  attempts: result.attempts,
  finalPermission: result.finalCompilation.permissions.find(
    (permission) => permission.permission === "mail:send"
  ),
  revisionHistory: result.finalCompilation.revisionHistory,
  harnessContractHash: proofBundle.harnessContractHash,
  verifierContractHash: proofBundle.verifierContractHash,
  proofHash: proofBundle.proofHash,
  proofPackage: path.basename(proofPath),
  proofPackageSha256: sha256(proof)
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      evidence: evidencePath,
      proof: proofPath,
      attempts: result.attempts.length,
      finalStatus: result.finalVerification.status,
      proofPackageSha256: evidence.proofPackageSha256
    },
    null,
    2
  )
);

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
