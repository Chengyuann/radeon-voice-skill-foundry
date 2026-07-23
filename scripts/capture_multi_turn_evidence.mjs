import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const root = process.cwd();
const baseUrl =
  process.env.MULTI_TURN_EVIDENCE_URL ||
  "https://radeon-voice-skill-foundry.pages.dev/";
const audioPath =
  process.env.MULTI_TURN_EVIDENCE_AUDIO ||
  path.join(root, "outputs", "audio", "voice-sop-zh.wav");
const outputDir = path.join(root, "submission");
const isolatedDataDir = path.join(root, "tmp", "submission-evidence-data");
const projectName = `policy-refinement-${Date.now().toString(36)}`;
const revisionMessage =
  "Always require confirmation before creating calendar holds.";
const nodeModules =
  process.env.CODEX_NODE_MODULES ||
  "/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledRequire = createRequire(path.join(nodeModules, "package.json"));
const { chromium } = bundledRequire("playwright");
const execFileAsync = promisify(execFile);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
  reducedMotion: "reduce"
});
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".cinematic-hero", { timeout: 30_000 });
  await page.getByRole("button", { name: "Voice", exact: true }).click();
  await page.getByLabel("Skill name").fill(projectName);
  await page.locator('input[type="file"]').setInputFiles(audioPath);
  await page.getByText("Voice Evidence Gate", { exact: true }).waitFor({
    state: "visible",
    timeout: 90_000
  });
  await page.getByText("No acoustic diagnostics triggered.", {
    exact: true
  }).waitFor({ state: "visible", timeout: 30_000 });

  for (const name of [
    "Open review",
    "P0/P1 only",
    "Review owner",
    "Draft email",
    "Draft holds",
    "Export report"
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await page.getByText("Demonstration contract captured", {
    exact: true
  }).waitFor({ state: "visible", timeout: 30_000 });

  const compileResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/compile") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", {
    name: "Compile voice + actions",
    exact: true
  }).click();
  const compileResponse = await compileResponsePromise;
  if (!compileResponse.ok()) {
    throw new Error(`Compilation failed with HTTP ${compileResponse.status()}`);
  }
  const parentCompilation = await compileResponse.json();
  await waitForPolicy(page);
  const parentVerification = await verifyRun(page, parentCompilation);
  await downloadPackage(
    page,
    parentVerification.proofBundle.runId,
    path.join(outputDir, "VERIFIED_WORKFLOW_PROOF.zip")
  );

  await page.getByLabel("Policy correction").fill(revisionMessage);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/refine") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", {
    name: "Create revision 2",
    exact: true
  }).click();
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(`Refinement failed with HTTP ${response.status()}`);
  }
  const refined = await response.json();
  const refinedVerification = await verifyRun(page, refined);
  await downloadPackage(
    page,
    refined.runId,
    path.join(outputDir, "MULTI_TURN_REFINEMENT_PROOF.zip")
  );
  await page.getByText("revision 2", { exact: true }).waitFor({
    state: "visible",
    timeout: 160_000
  });
  await page.getByText(/calendar holds/i).first().waitFor({
    state: "visible",
    timeout: 30_000
  });

  await page.locator(".revision-session").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_000);
  await page.screenshot({
    path: path.join(outputDir, "MULTI_TURN_REFINEMENT.png"),
    fullPage: true
  });

  const evidence = {
    schemaVersion: "0.2.0",
    capturedAt: new Date().toISOString(),
    publicProduct: baseUrl,
    projectName,
    userRevision: revisionMessage,
    revision: refined.revision,
    parentRunId: refined.parentRunId,
    runId: refined.runId,
    revisionHistory: refined.revisionHistory,
    runtime: refined.runtime,
    constraints: refined.constraints.map((constraint) => ({
      kind: constraint.kind,
      statement: constraint.statement,
      appliesTo: constraint.appliesTo
    })),
    generatedFixtureCount: refined.fixtures.length,
    ragMatchCount: refined.ragMatches?.length || 0,
    proofHash: refinedVerification.proofBundle.proofHash
  };
  await writeFile(
    path.join(outputDir, "MULTI_TURN_REFINEMENT.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
  await writeGovernanceSample(parentCompilation, parentVerification);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await context.close();
  await browser.close();
}

async function verifyRun(page, compilation) {
  const response = await page.request.post(
    new URL("/api/verify", baseUrl).toString(),
    { data: { compilation, actions: [] } }
  );
  if (!response.ok()) {
    throw new Error(`Verification failed with HTTP ${response.status()}`);
  }
  return response.json();
}

async function downloadPackage(page, runId, destination) {
  const response = await page.request.get(
    new URL(`/api/package/${runId}`, baseUrl).toString()
  );
  if (!response.ok()) {
    throw new Error(`Proof download failed with HTTP ${response.status()}`);
  }
  await writeFile(destination, await response.body());
}

async function writeGovernanceSample(compilation, verification) {
  await rm(isolatedDataDir, { recursive: true, force: true });
  await mkdir(isolatedDataDir, { recursive: true });
  const inputPath = path.join(isolatedDataDir, "input.json");
  await writeFile(
    inputPath,
    `${JSON.stringify({ compilation, verification }, null, 2)}\n`,
    "utf8"
  );
  await execFileAsync(
    path.join(root, "node_modules", ".bin", "tsx"),
    [
      path.join(root, "scripts", "build_governance_sample.ts"),
      inputPath,
      path.join(outputDir, "GOVERNANCE_LEDGER.jsonl")
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        RVSF_DATA_DIR: isolatedDataDir,
        RADEON_OPENAI_BASE_URL: "https://submission-evidence.invalid/v1",
        RADEON_MODEL: verification.proofBundle.runtime.model,
        RADEON_ASR_MODEL: verification.proofBundle.runtime.asrModel,
        RADEON_GPU_NAME: verification.proofBundle.runtime.gpu,
        ROCM_VERSION: verification.proofBundle.runtime.rocm,
        RADEON_ASR_RTF: String(verification.proofBundle.runtime.asrRtf),
        RADEON_ASR_X_REALTIME: String(
          verification.proofBundle.runtime.asrXRealtime
        ),
        RADEON_ASR_PEAK_VRAM_GIB: String(
          verification.proofBundle.runtime.asrPeakVramGiB
        )
      }
    }
  );
}

async function waitForPolicy(page) {
  const deadline = Date.now() + 160_000;
  while (Date.now() < deadline) {
    if (await page.locator(".constraint-panel").isVisible()) return;
    const error = await page
      .locator(".module-error")
      .textContent()
      .catch(() => "");
    if (error) throw new Error(`Public compilation failed: ${error}`);
    await page.waitForTimeout(1_000);
  }
  throw new Error("Policy module did not appear after public compilation");
}
