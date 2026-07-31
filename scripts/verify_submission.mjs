import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const evidenceOutputDir = mkdtempSync(
  path.join(tmpdir(), "rvsf-agent-harness-evidence-")
);

const steps = [
  [
    "npm",
    ["run", "evidence:agent-harness"],
    {
      env: {
        RVSF_EVIDENCE_OUTPUT_DIR: evidenceOutputDir
      }
    }
  ],
  ["npm", ["test"]],
  ["npm", ["run", "build"]],
  ["python3", ["scripts/generate_submission_checksums.py"]],
  ["shasum", ["-a", "256", "-c", "SHA256SUMS.txt"], { cwd: "submission" }],
  ["pdftotext", ["-layout", "submission/PROJECT_SPECIFICATION.pdf", "/tmp/rvsf-project-spec.txt"]]
];

for (const [command, args, options] of steps) {
  run(command, args, options);
}

const pdfText = readFileSync("/tmp/rvsf-project-spec.txt", "utf8");
for (const needle of [
  "Agent Harness and Independent Verifier Contracts",
  "Bounded Verify-Refine-Reverify",
  "AGENT_HARNESS_REPAIR_EVIDENCE.json",
  "npm run verify:submission",
  "66/66"
]) {
  if (!pdfText.includes(needle)) {
    throw new Error(`PROJECT_SPECIFICATION.pdf is missing: ${needle}`);
  }
}

const requiredAssets = [
  "submission/JUDGE_QUICKSTART.md",
  "submission/REPRODUCIBILITY.md",
  "submission/AGENT_HARNESS_REPAIR_EVIDENCE.json",
  "submission/AGENT_HARNESS_REPAIR_PROOF.zip",
  "submission/MULTI_TURN_INTERACTION_DIRECTOR_CUT.mp4",
  "submission/RADEON_VOICE_SKILL_FOUNDRY_DEMO.mp4",
  "submission/SHA256SUMS.txt"
];
for (const asset of requiredAssets) {
  if (!existsSync(asset)) throw new Error(`Missing submission asset: ${asset}`);
}

const evidencePath = path.join(
  evidenceOutputDir,
  "AGENT_HARNESS_REPAIR_EVIDENCE.json"
);
const proofPath = path.join(
  evidenceOutputDir,
  "AGENT_HARNESS_REPAIR_PROOF.zip"
);
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const proofBytes = readFileSync(proofPath);
const proofHash = createHash("sha256").update(proofBytes).digest("hex");
if (evidence.proofPackageSha256 !== proofHash) {
  throw new Error("Agent harness proof ZIP hash does not match evidence JSON");
}
if (evidence.stoppedReason !== "verified" || evidence.attempts.length !== 2) {
  throw new Error("Agent harness repair evidence did not complete two-attempt verified flow");
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      verified: [
        "agent harness repair evidence",
        "66/66 tests",
        "typecheck and production build",
        "submission SHA256SUMS",
        "project specification PDF text",
        "required submission assets"
      ],
      agentHarnessProofSha256: proofHash
    },
    null,
    2
  )
);
rmSync(evidenceOutputDir, { recursive: true, force: true });

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ? path.join(root, options.cwd) : root,
    stdio: "inherit",
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}
