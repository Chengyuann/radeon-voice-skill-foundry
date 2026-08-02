#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const baseUrl = (
  process.env.RVSF_LIVE_EVIDENCE_URL ||
  "https://radeon-voice-skill-foundry.pages.dev"
).replace(/\/$/, "");
const audioPath =
  process.env.RVSF_LIVE_EVIDENCE_AUDIO ||
  path.join(root, "outputs", "audio", "voice-sop-zh.wav");
const outputDir =
  process.env.RVSF_LIVE_EVIDENCE_OUTPUT_DIR ||
  path.join(root, "tmp", "live-w7900-evidence");
const rawDir = path.join(outputDir, "raw");
const nodeModules =
  process.env.CODEX_NODE_MODULES ||
  "/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledRequire = createRequire(path.join(nodeModules, "package.json"));
const { chromium } = bundledRequire("playwright");

const transcriptFallback =
  "After each project review, process only P0 and P1 findings. External reports must not include salary data. Emails can only be drafted and must not be sent automatically. If the owner is missing, mark it as needs confirmation. Create calendar holds only when a due date exists.";
const scenario =
  "Convert a private voice SOP and six server-side workflow actions into a verified Agent Skill with least-privilege permissions and proof hashing.";
const commandTypes = [
  "open",
  "filter",
  "confirm_missing_owner",
  "draft_emails",
  "create_holds",
  "export_report"
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });

const audio = await readFile(audioPath);
const audioSha256 = createHash("sha256").update(audio).digest("hex");
const startedAt = new Date();
let browser;
let context;
let page;
const timeline = [];

try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  });
  context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1600, height: 900 }
    },
    reducedMotion: "reduce"
  });
  page = await context.newPage();
  const video = page.video();

  await showPayload(page, "Starting W7900 live evidence run", {
    baseUrl,
    startedAt: startedAt.toISOString(),
    audioSha256
  });
  await hold(2_000);

  const health = await step(page, "1/4 health", async () => {
    const value = await requestJson(page, "/api/health");
    assert(value.ok === true, "health.ok must be true");
    assert(value.healthy === true, "health.healthy must be true");
    assert(value.runtime?.mode === "radeon", "runtime.mode must be radeon");
    assert(
      value.dependencies?.model === "healthy" &&
        value.dependencies?.asr === "healthy",
      "model and ASR dependencies must be healthy"
    );
    return value;
  });

  const transcription = await step(page, "2/4 ASR", async () => {
    const value = await requestJson(page, "/api/transcribe", {
      method: "POST",
      multipart: {
        audio: {
          name: path.basename(audioPath),
          mimeType: "audio/wav",
          buffer: audio
        }
      }
    });
    assert(value.transcript, "ASR transcript is required");
    return value;
  });

  const demonstration = await requestJson(page, "/api/demonstrations", {
    method: "POST"
  });
  for (const type of commandTypes) {
    const updated = await requestJson(
      page,
      `/api/demonstrations/${demonstration.id}/commands`,
      {
        method: "POST",
        data: { type }
      }
    );
    demonstration.state = updated.state;
  }
  assert(demonstration.state?.events?.length === 6, "six actions required");

  const compilation = await step(page, "3/4 compile on W7900", async () => {
    const value = await requestJson(page, "/api/compile", {
      method: "POST",
      data: {
        projectName: `unedited-w7900-${Date.now().toString(36)}`,
        scenario,
        transcript: transcription.transcript || transcriptFallback,
        actions: demonstration.state.events,
        demonstrationSessionId: demonstration.id,
        useModel: true,
        voiceEvidenceId: transcription.voiceEvidenceId
      }
    });
    assert(value.runId, "compile runId required");
    assert(value.runtime?.mode === "radeon", "compile must use Radeon runtime");
    return value;
  });

  const verification = await step(page, "4/4 verify and proof hash", async () => {
    const value = await requestJson(page, "/api/verify", {
      method: "POST",
      data: {
        compilation,
        actions: demonstration.state.events
      }
    });
    assert(value.status === "verified", "verification must pass");
    assert(
      /^[a-f0-9]{64}$/.test(value.proofBundle?.proofHash || ""),
      "proof hash required"
    );
    return value;
  });

  const summary = {
    schemaVersion: "0.1.0",
    startedAt: startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    baseUrl,
    unedited: true,
    captureMethod: "single Playwright page video; no cuts; MP4 is a transcode of the raw WebM",
    audio: {
      path: "outputs/audio/voice-sop-zh.wav",
      sha256: audioSha256,
      seconds: transcription.audioSeconds
    },
    health: {
      ok: health.ok,
      healthy: health.healthy,
      dependencies: health.dependencies,
      runtime: health.runtime
    },
    asr: {
      transcript: transcription.transcript,
      language: transcription.language,
      inferenceMs: transcription.inferenceMs,
      rtf: transcription.rtf,
      xRealtime: transcription.xRealtime,
      qualityScore: transcription.voiceEvidence?.qualityScore,
      voiceEvidenceId: transcription.voiceEvidenceId
    },
    compile: {
      runId: compilation.runId,
      revision: compilation.revision,
      constraints: compilation.constraints?.length,
      fixtures: compilation.fixtures?.length,
      modelMetrics: compilation.modelMetrics,
      runtime: compilation.runtime
    },
    verify: {
      status: verification.status,
      runId: verification.runId,
      passedFixtures: verification.fixtures?.filter(
        (fixture) => fixture.status === "passed"
      ).length,
      totalFixtures: verification.fixtures?.length,
      verificationDurationMs: verification.verificationDurationMs,
      proofHash: verification.proofBundle.proofHash,
      harnessContractHash:
        verification.proofBundle.compatibility?.harnessContractHash,
      verifierContractHash:
        verification.proofBundle.compatibility?.verifierContractHash
    },
    timeline
  };

  await showPayload(page, "W7900 live evidence complete", summary);
  await hold(8_000);
  await context.close();
  await browser.close();
  const rawVideo = await video.path();
  const rawOutput = path.join(outputDir, "W7900_LIVE_EVIDENCE_UNEDITED.webm");
  await writeFile(
    path.join(outputDir, "W7900_LIVE_EVIDENCE_SUMMARY.json"),
    JSON.stringify(summary, null, 2) + "\n"
  );
  await copyFromPlaywright(rawVideo, rawOutput);
  console.log(
    JSON.stringify(
      {
        rawVideo: rawOutput,
        summary: path.join(outputDir, "W7900_LIVE_EVIDENCE_SUMMARY.json"),
        proofHash: summary.verify.proofHash
      },
      null,
      2
    )
  );
} finally {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
}

async function step(page, label, action) {
  const started = performance.now();
  await showPayload(page, label, { status: "running" });
  const value = await action();
  const elapsedMs = Math.round(performance.now() - started);
  timeline.push({ label, elapsedMs });
  await showPayload(page, label, compact(label, value, elapsedMs));
  await hold(2_500);
  return value;
}

function compact(label, value, elapsedMs) {
  if (label.includes("health")) {
    return {
      elapsedMs,
      ok: value.ok,
      healthy: value.healthy,
      dependencies: value.dependencies,
      runtime: {
        mode: value.runtime?.mode,
        model: value.runtime?.model,
        asrModel: value.runtime?.asrModel,
        gpu: value.runtime?.gpu,
        rocm: value.runtime?.rocm
      }
    };
  }
  if (label.includes("ASR")) {
    return {
      elapsedMs,
      language: value.language,
      audioSeconds: value.audioSeconds,
      inferenceMs: value.inferenceMs,
      rtf: value.rtf,
      xRealtime: value.xRealtime,
      qualityScore: value.voiceEvidence?.qualityScore,
      transcript: value.transcript
    };
  }
  if (label.includes("compile")) {
    return {
      elapsedMs,
      runId: value.runId,
      runtime: value.runtime,
      constraints: value.constraints?.length,
      fixtures: value.fixtures?.length,
      modelMetrics: value.modelMetrics
    };
  }
  return {
    elapsedMs,
    status: value.status,
    runId: value.runId,
    passedFixtures: value.fixtures?.filter((fixture) => fixture.status === "passed").length,
    totalFixtures: value.fixtures?.length,
    proofHash: value.proofBundle?.proofHash,
    harnessContractHash: value.proofBundle?.compatibility?.harnessContractHash,
    verifierContractHash: value.proofBundle?.compatibility?.verifierContractHash
  };
}

async function showPayload(page, title, payload) {
  await page.setContent(
    `<!doctype html>
<meta charset="utf-8" />
<style>
body{margin:0;background:#0f1214;color:#f4f7f8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
main{padding:32px 38px}
.bar{display:flex;justify-content:space-between;gap:24px;align-items:center;border-bottom:1px solid #3b4146;padding-bottom:18px;margin-bottom:22px}
h1{font-size:30px;line-height:1.15;margin:0;color:#fff;letter-spacing:0}
.pill{background:#2f6a4f;color:#fff;padding:7px 10px;border-radius:4px;font-weight:700}
pre{white-space:pre-wrap;word-break:break-word;font-size:20px;line-height:1.42;margin:0;background:#171b1e;border-left:5px solid #c23a35;padding:22px;min-height:650px}
.footer{margin-top:18px;color:#aeb7bd;font-size:16px}
</style>
<main>
  <div class="bar">
    <h1>${escapeHtml(title)}</h1>
    <div class="pill">LIVE W7900 · ROCm · unedited capture</div>
  </div>
  <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
  <div class="footer">Captured from ${escapeHtml(baseUrl)} · ${new Date().toISOString()}</div>
</main>`,
    { waitUntil: "load" }
  );
}

async function requestJson(page, pathname, options = {}) {
  const response =
    options.method === "POST"
      ? await page.request.post(`${baseUrl}${pathname}`, {
          ...(options.data ? { data: options.data } : {}),
          ...(options.multipart ? { multipart: options.multipart } : {})
        })
      : await page.request.get(`${baseUrl}${pathname}`);
  const payload = await response.json();
  if (!response.ok()) {
    throw new Error(
      JSON.stringify({ status: response.status(), payload })
    );
  }
  return payload;
}

async function copyFromPlaywright(source, destination) {
  const data = await readFile(source);
  await writeFile(destination, data);
}

function hold(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
