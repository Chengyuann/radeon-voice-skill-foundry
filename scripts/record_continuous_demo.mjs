import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.CONTINUOUS_DEMO_PORT || 8798);
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = path.join(root, "tmp", "continuous-demo", "data");
const rawDir = path.join(root, "tmp", "continuous-demo", "raw");
const outputDir = path.join(root, "tmp", "continuous-demo");
const audioPath =
  process.env.CONTINUOUS_DEMO_AUDIO ||
  path.join(root, "outputs", "audio", "voice-sop-zh.wav");
const timingPath =
  process.env.CONTINUOUS_DEMO_TIMINGS ||
  path.join(root, "tmp", "continuous-narration", "timings.json");
const defaultDurations = [16, 24, 22, 22, 19, 20, 20, 24];
const labels = [
  "Open the workbench",
  "Upload the spoken SOP",
  "Compile voice into policy",
  "Run adversarial verification",
  "Save and reuse the verified skill",
  "Restart and recover durable runs",
  "Change runtime and invalidate proof",
  "Revalidate and download proof"
];

const nodeModules =
  process.env.CODEX_NODE_MODULES ||
  "/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledRequire = createRequire(path.join(nodeModules, "package.json"));
const { chromium } = bundledRequire("playwright");

let server;
let serverLog;
const events = [];
const recordingStartedAt = Date.now();

await rm(dataDir, { recursive: true, force: true });
await rm(rawDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });
const durations = await loadDurations();

try {
  server = await startServer("Qwen3 local adapter pending");
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1440, height: 900 }
    },
    acceptDownloads: true
  });
  await context.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const cursor = document.createElement("div");
      cursor.id = "continuous-demo-cursor";
      cursor.style.cssText =
        "position:fixed;z-index:2147483647;width:22px;height:22px;" +
        "border:2px solid #fff;border-radius:50%;background:#c23a35aa;" +
        "pointer-events:none;transform:translate(-50%,-50%);" +
        "box-shadow:0 0 0 4px #20222488;";
      const label = document.createElement("div");
      label.id = "continuous-demo-label";
      label.style.cssText =
        "position:fixed;z-index:2147483646;left:24px;bottom:24px;" +
        "max-width:520px;padding:12px 16px;color:white;background:#202224ee;" +
        "border-left:5px solid #c23a35;font:600 18px Arial;" +
        "box-shadow:0 8px 24px #0008;pointer-events:none;";
      label.textContent = "Continuous operation demo";
      document.body.append(cursor, label);
      document.addEventListener("mousemove", (event) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      });
    });
  });
  const page = await context.newPage();
  const video = page.video();

  await runStep(page, 0, async () => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector(".app-shell");
    await page.mouse.move(900, 130, { steps: 18 });
  });

  await runStep(page, 1, async () => {
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(audioPath);
    await page.getByText("Voice Evidence Gate").waitFor();
    await page.getByText("No acoustic diagnostics triggered.").waitFor();
    await show(page, page.locator(".voice-evidence"));
  });

  await runStep(page, 2, async () => {
    await click(page, page.getByRole("button", { name: "Compile spoken SOP" }));
    await page.getByText("mail:send", { exact: true }).waitFor();
    await show(page, page.locator(".constraint-panel"));
  });

  await runStep(page, 3, async () => {
    await click(
      page,
      page.getByRole("button", { name: "Run local verification" })
    );
    await page.getByText("Proof verified").waitFor();
    await page.getByText("7/7").waitFor();
    await show(page, page.locator(".proof-panel"));
  });

  await runStep(page, 4, async () => {
    await click(
      page,
      page.getByRole("button", { name: "Save verified skill" })
    );
    await page.getByText("Saved to skill memory").waitFor();
    await show(page, page.locator(".memory-panel"));
    await click(page, page.getByRole("button", { name: "Reuse" }));
    await page.getByText(/ms/).waitFor();
  });

  await runStep(page, 5, async () => {
    await stopServer();
    server = await startServer("Qwen3 local adapter pending");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("proof compatible").waitFor();
    await show(page, page.locator(".memory-panel"));
    await click(page, page.getByRole("button", { name: "Reuse" }));
  });

  await runStep(page, 6, async () => {
    await stopServer();
    server = await startServer("Changed runtime model");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("revalidation required").waitFor();
    await show(page, page.locator(".memory-panel"));
  });

  await runStep(page, 7, async () => {
    await click(page, page.getByRole("button", { name: "Revalidate" }));
    await page.getByText("Proof verified").waitFor();
    await page.getByText("proof compatible").waitFor();
    await show(page, page.locator(".proof-panel"));
    const downloadPromise = page.waitForEvent("download");
    await click(
      page,
      page.getByText("Download proof package", { exact: true })
    );
    const download = await downloadPromise;
    await download.saveAs(
      path.join(outputDir, "continuous-demo-proof.zip")
    );
    await page.evaluate(() => {
      const label = document.getElementById("continuous-demo-label");
      if (label) label.textContent = "Proof downloaded · workflow complete";
    });
  });

  await context.close();
  await browser.close();
  const rawVideo = await video.path();
  await copyFile(
    rawVideo,
    path.join(outputDir, "continuous-demo-raw.webm")
  );
  await writeFile(
    path.join(outputDir, "events.json"),
    JSON.stringify(events, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        video: path.join(outputDir, "continuous-demo-raw.webm"),
        events: path.join(outputDir, "events.json"),
        proof: path.join(outputDir, "continuous-demo-proof.zip")
      },
      null,
      2
    )
  );
} finally {
  await stopServer();
}

async function loadDurations() {
  try {
    const parsed = JSON.parse(await readFile(timingPath, "utf8"));
    return labels.map(
      (_label, index) => Number(parsed[index]?.duration) || defaultDurations[index]
    );
  } catch {
    return defaultDurations;
  }
}

async function runStep(page, index, action) {
  console.log(`STEP ${index + 1}/${labels.length}: ${labels[index]}`);
  const started = elapsed();
  await page.evaluate(
    ({ current, total, text }) => {
      const label = document.getElementById("continuous-demo-label");
      if (label) label.textContent = `${current}/${total} · ${text}`;
    },
    { current: index + 1, total: labels.length, text: labels[index] }
  );
  await action();
  const targetMs = durations[index] * 1_000;
  const usedMs = elapsed() - started;
  await page.waitForTimeout(Math.max(800, targetMs - usedMs));
  events.push({
    index: index + 1,
    label: labels[index],
    startMs: started,
    endMs: elapsed()
  });
  console.log(`DONE ${index + 1}/${labels.length}`);
}

async function click(page, locator) {
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
      { steps: 16 }
    );
    await page.waitForTimeout(350);
  }
  await locator.click();
  await page.waitForTimeout(700);
}

async function show(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_000);
}

async function startServer(model) {
  await mkdir(outputDir, { recursive: true });
  serverLog = await open(path.join(outputDir, "server.log"), "a");
  const child = spawn("npm", ["start"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      RADEON_MODEL: model,
      RADEON_ASR_COMMAND: "node scripts/demo_asr_fixture.mjs",
      RADEON_ASR_MODEL: "Continuous demo ASR fixture",
      RVSF_DATA_DIR: dataDir
    },
    stdio: ["ignore", serverLog.fd, serverLog.fd]
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return child;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Continuous demo server did not start");
}

async function stopServer() {
  if (!server) return;
  try {
    server.kill("SIGTERM");
  } catch {
    // The process group already exited.
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  await serverLog?.close();
  server = undefined;
}

function elapsed() {
  return Date.now() - recordingStartedAt;
}
