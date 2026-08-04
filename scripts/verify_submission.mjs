import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
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

hydrateMissingReleaseAssets();

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
  ["npm", ["run", "test:watchdog"]],
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
  "Participant: Chengyuan Ma",
  "Team: None (solo)",
  "Agent Harness and Independent Verifier Contracts",
  "Bounded Verify-Refine-Reverify",
  "AGENT_HARNESS_REPAIR_EVIDENCE.json",
  "npm run verify:submission",
  "68/68"
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
  "submission/RADEON_VOICE_SKILL_FOUNDRY_DEMO.srt",
  "submission/RADEON_VOICE_SKILL_FOUNDRY_PERFORMANCE_DEMO.srt",
  "submission/CONTINUOUS_OPERATION_DEMO.srt",
  "submission/MULTI_TURN_INTERACTION_DEMO.srt",
  "submission/MULTI_TURN_INTERACTION_DIRECTOR_CUT.srt",
  "submission/PUBLIC_HEALTH_HISTORY.jsonl",
  "submission/PUBLIC_HEALTH_SUMMARY.json",
  "submission/GITHUB_SCHEDULED_HEALTH_SUMMARY.json",
  "submission/AUDIO_NATIVE_POLICY_CRITIC_SUMMARY.json",
  "submission/evidence/BOARD_ENERGY_SUMMARY.json",
  "submission/W7900_LIVE_EVIDENCE_SUMMARY.json",
  "submission/W7900_LIVE_EVIDENCE_UNEDITED.mp4",
  "submission/W7900_LIVE_EVIDENCE_UNEDITED.srt",
  "submission/W7900_LIVE_EVIDENCE_UNEDITED.webm",
  "submission/SHA256SUMS.txt"
];
for (const asset of requiredAssets) {
  if (!existsSync(asset)) throw new Error(`Missing submission asset: ${asset}`);
}

const productProbe = JSON.parse(
  runCapture("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type,codec_name:stream_tags=language",
    "-of",
    "json",
    "submission/RADEON_VOICE_SKILL_FOUNDRY_DEMO.mp4"
  ])
);
const productDuration = Number(productProbe.format?.duration || 0);
const productStreams = productProbe.streams || [];
if (
  productDuration < 180 ||
  productDuration > 300 ||
  !productStreams.some(
    (stream) =>
      stream.codec_type === "video" && stream.codec_name === "h264"
  ) ||
  !productStreams.some(
    (stream) =>
      stream.codec_type === "audio" && stream.codec_name === "aac"
  ) ||
  !productStreams.some(
    (stream) =>
      stream.codec_type === "subtitle" &&
      stream.codec_name === "mov_text" &&
      stream.tags?.language === "eng"
  )
) {
  throw new Error("Primary Product Demo media contract failed");
}

const uneditedCaptions = readFileSync(
  "submission/W7900_LIVE_EVIDENCE_UNEDITED.srt",
  "utf8"
);
if (
  !uneditedCaptions.includes("00:00:48,960") ||
  !uneditedCaptions.includes("health -> ASR -> compile -> verify -> proof hash")
) {
  throw new Error("Unedited W7900 stage captions are incomplete");
}

const submissionReadme = readFileSync("submission/README.md", "utf8");
if (
  !submissionReadme.includes("Participant:** Chengyuan Ma") ||
  !submissionReadme.includes("Team:** None (solo)")
) {
  throw new Error("Submission identity does not match the registered solo participant");
}

const healthSummary = JSON.parse(
  readFileSync("submission/PUBLIC_HEALTH_SUMMARY.json", "utf8")
);
if (
  healthSummary.durationMinutes < 180 ||
  healthSummary.sampleCount < 36 ||
  healthSummary.healthyCount !== healthSummary.sampleCount ||
  healthSummary.failureCount !== 0
) {
  throw new Error("Public health history does not prove three stable hours");
}

const githubHealthSummary = JSON.parse(
  readFileSync("submission/GITHUB_SCHEDULED_HEALTH_SUMMARY.json", "utf8")
);
if (
  githubHealthSummary.observedDurationHours < 48 ||
  githubHealthSummary.runCount < 25 ||
  githubHealthSummary.successCount !== githubHealthSummary.runCount ||
  githubHealthSummary.failureCount !== 0 ||
  !String(githubHealthSummary.schedulerBoundary || "").includes("best-effort")
) {
  throw new Error("GitHub scheduled health evidence is incomplete");
}

const audioNativeSummary = JSON.parse(
  readFileSync(
    "submission/AUDIO_NATIVE_POLICY_CRITIC_SUMMARY.json",
    "utf8"
  )
);
if (
  audioNativeSummary.model !== "Qwen/Qwen2.5-Omni-3B" ||
  audioNativeSummary.summary.baselineAdmitted !== false ||
  audioNativeSummary.summary.strictVariantCount !== 3 ||
  audioNativeSummary.summary.strictAdmittedCount !== 3 ||
  audioNativeSummary.summary.noiseSafetyKindsPreserved !== true ||
  audioNativeSummary.summary.alertSafetyKindsPreserved !== true ||
  audioNativeSummary.summary.alertPolicyKindsUnchanged !== true ||
  audioNativeSummary.decision.status !== "research-candidate-only" ||
  !String(audioNativeSummary.licenseBoundary).includes(
    "non-commercial research/evaluation only"
  )
) {
  throw new Error("Audio-native policy critic evidence is incomplete");
}

const boardEnergySummary = JSON.parse(
  readFileSync("submission/evidence/BOARD_ENERGY_SUMMARY.json", "utf8")
);
if (
  boardEnergySummary.variants?.transformersFp16?.requestCount !== 51 ||
  boardEnergySummary.variants?.vllmGraphFp16?.requestCount !== 51 ||
  boardEnergySummary.comparison
    ?.vllmGraphVsTransformersOutputTokensPerBoardJouleX !== 4.79 ||
  boardEnergySummary.comparison
    ?.vllmGraphVsTransformersBoardEnergyReductionPercent !== 78.76 ||
  !String(boardEnergySummary.measurementBoundary).includes(
    "Board-level GPU package energy only"
  )
) {
  throw new Error("Board-energy evidence is incomplete");
}

const liveEvidence = JSON.parse(
  readFileSync("submission/W7900_LIVE_EVIDENCE_SUMMARY.json", "utf8")
);
if (
  liveEvidence.unedited !== true ||
  liveEvidence.health?.healthy !== true ||
  liveEvidence.health?.runtime?.mode !== "radeon" ||
  liveEvidence.health?.dependencies?.model !== "healthy" ||
  liveEvidence.health?.dependencies?.asr !== "healthy" ||
  liveEvidence.verify?.status !== "verified" ||
  liveEvidence.verify?.passedFixtures !== liveEvidence.verify?.totalFixtures ||
  !/^[a-f0-9]{64}$/.test(liveEvidence.verify?.proofHash || "")
) {
  throw new Error("Unedited W7900 evidence summary failed semantic checks");
}
for (const [mediaKey, mediaPath] of [
  ["rawWebm", "submission/W7900_LIVE_EVIDENCE_UNEDITED.webm"],
  ["releaseMp4", "submission/W7900_LIVE_EVIDENCE_UNEDITED.mp4"]
]) {
  const expected = liveEvidence.media?.[mediaKey]?.sha256;
  const actual = createHash("sha256")
    .update(readFileSync(mediaPath))
    .digest("hex");
  if (expected !== actual) {
    throw new Error(`${mediaKey} SHA-256 does not match live evidence summary`);
  }
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
        "68/68 tests",
        "independent supervisor watchdog",
        "clean-clone Release asset hydration",
        "three-hour public health history",
        "GitHub scheduled health history",
        "audio-native policy critic admission",
        "fixed-workload board-energy integration",
        "unedited W7900 live evidence",
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

function hydrateMissingReleaseAssets() {
  const manifestPath = path.join(root, "submission", "SHA256SUMS.txt");
  const releaseBase =
    "https://github.com/Chengyuann/radeon-voice-skill-foundry/releases/download/submission";
  const entries = readFileSync(manifestPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})  (.+)$/);
      if (!match) throw new Error(`Invalid checksum manifest line: ${line}`);
      return { sha256: match[1], relativePath: match[2] };
    });

  for (const entry of entries) {
    const destination = path.join(root, "submission", entry.relativePath);
    if (existsSync(destination)) continue;
    mkdirSync(path.dirname(destination), { recursive: true });
    const assetName = path.basename(entry.relativePath);
    console.log(`\n$ hydrate Release asset ${assetName}`);
    run(
      "curl",
      [
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "300",
        `${releaseBase}/${encodeURIComponent(assetName)}`,
        "--output",
        destination
      ],
      {}
    );
    const actual = createHash("sha256")
      .update(readFileSync(destination))
      .digest("hex");
    if (actual !== entry.sha256) {
      throw new Error(`Hydrated asset hash mismatch: ${entry.relativePath}`);
    }
  }
}

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

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`
    );
  }
  return result.stdout;
}
