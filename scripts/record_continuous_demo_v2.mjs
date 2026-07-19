import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const instanceId =
  process.env.RADEON_INSTANCE || "u-8159-8576a2be";
const terminalName = `continuous-v2-${Date.now().toString(36)}`;
const jupyterBase =
  `https://radeon-global.anruicloud.com/instances/${instanceId}`;
const jupyterToken = "amd-oneclick";
const remoteRepo = "/workspace/radeon-voice-skill-foundry-live";
const remotePort = Number(process.env.CONTINUOUS_V2_PORT || 8793);
const localPort = Number(process.env.CONTINUOUS_V2_WEB_PORT || 5181);
const baseUrl = `http://127.0.0.1:${localPort}`;
const runId = randomBytes(6).toString("hex");
const suppliedUrl = process.env.CONTINUOUS_V2_URL || "";
const suppliedToken = process.env.CONTINUOUS_V2_API_TOKEN || "";
const manageRemoteStack = !suppliedUrl;
const apiToken = suppliedToken || randomBytes(32).toString("hex");
const remotePrefix = `/workspace/rvsf-continuous-v2-${runId}`;
const remoteDataDir = `${remotePrefix}-data`;
const apiPidFile = `${remotePrefix}-api.pid`;
const apiLog = `${remotePrefix}-api.log`;
const tunnelPidFile = `${remotePrefix}-tunnel.pid`;
const tunnelLog = `${remotePrefix}-tunnel.log`;
const outputDir = path.join(root, "tmp", "continuous-demo-v2", "recording");
const rawDir = path.join(outputDir, "raw");
const audioPath =
  process.env.CONTINUOUS_V2_AUDIO ||
  path.join(root, "outputs", "audio", "voice-sop-zh.wav");
const timingPath = path.join(
  root,
  "tmp",
  "continuous-demo-v2",
  "narration",
  "timings.json"
);
const projectName = "review-followup-lifecycle-v2";
const labels = [
  "Open the isolated W7900 session",
  "Upload the spoken SOP",
  "Compile voice into policy",
  "Verify the unsafe paths",
  "Save and reuse the skill",
  "Restart and recover durable state",
  "Drift the runtime and invalidate proof",
  "Revalidate and download the child proof"
];
const defaultDurations = [30, 32, 48, 34, 28, 30, 30, 42];
const nodeModules =
  process.env.CODEX_NODE_MODULES ||
  "/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledRequire = createRequire(path.join(nodeModules, "package.json"));
const { chromium } = bundledRequire("playwright");
const events = [];
const recordingStartedAt = Date.now();
const durations = await loadDurations();

let browser;
let context;
let tunnelUrl = "";
let terminalCreated = false;
let viteProcess;

await rm(outputDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });

try {
  if (manageRemoteStack) {
    await createTerminal();
    terminalCreated = true;
    tunnelUrl = await setupRemoteStack();
  } else {
    if (!suppliedToken) {
      throw new Error(
        "Set CONTINUOUS_V2_API_TOKEN with CONTINUOUS_V2_URL"
      );
    }
    tunnelUrl = suppliedUrl.replace(/\/$/, "");
  }
  await waitForPublicHealth(tunnelUrl);
  viteProcess = await startLocalFrontend(tunnelUrl);

  browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  });
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1920, height: 1080 }
    },
    acceptDownloads: true,
    extraHTTPHeaders: {
      "x-rvsf-api-token": apiToken
    }
  });
  await context.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const label = document.createElement("div");
      label.id = "continuous-v2-label";
      label.style.cssText =
        "position:fixed;z-index:2147483646;left:30px;top:88px;" +
        "max-width:680px;padding:11px 15px;color:#f7f9fa;" +
        "background:#202224e8;border-left:4px solid #c23a35;" +
        "font:600 16px 'Geist Mono',monospace;" +
        "box-shadow:0 12px 32px #0007;pointer-events:none;";
      label.textContent = "ISOLATED W7900 LIFECYCLE";

      const cursor = document.createElement("div");
      cursor.id = "continuous-v2-cursor";
      cursor.style.cssText =
        "position:fixed;z-index:2147483647;width:20px;height:20px;" +
        "border:2px solid #fff;border-radius:50%;background:#c23a3577;" +
        "pointer-events:none;transform:translate(-50%,-50%);" +
        "box-shadow:0 0 0 4px #20222477;";
      document.body.append(label, cursor);
      document.addEventListener("mousemove", (event) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      });
    });
  });

  const page = await context.newPage();
  const video = page.video();

  await runStep(page, 0, async () => {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".cinematic-hero", { timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const media = document.querySelector("video");
        return media && media.readyState >= 3 && media.currentTime > 0.2;
      },
      undefined,
      { timeout: 30_000 }
    );
    await page.waitForTimeout(3_000);
    await click(
      page,
      page.getByRole("button", { name: "Voice", exact: true })
    );
    await page.getByLabel("Skill name").fill(projectName);
  });

  await runStep(page, 1, async () => {
    await page.locator('input[type="file"]').setInputFiles(audioPath);
    await page.getByText("Voice Evidence Gate", { exact: true }).waitFor({
      state: "visible",
      timeout: 60_000
    });
    await page.getByText("No acoustic diagnostics triggered.", {
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await show(page, page.locator(".voice-evidence"));
  });

  await runStep(page, 2, async () => {
    await click(
      page,
      page.getByRole("button", { name: "Compile spoken SOP", exact: true })
    );
    await waitForPanel(page, ".constraint-panel", "Policy");
    await show(page, page.locator(".constraint-panel"));
  });

  await runStep(page, 3, async () => {
    await click(
      page,
      page.getByRole("button", {
        name: "Run local verification",
        exact: true
      })
    );
    await waitForPanel(page, ".proof-panel", "Proof");
    await page.getByText("7/7", { exact: true }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await show(page, page.locator(".proof-panel"));
  });

  await runStep(page, 4, async () => {
    await click(
      page,
      page.getByRole("button", { name: "Save verified skill", exact: true })
    );
    await page.waitForSelector(".memory-panel", { timeout: 30_000 });
    const article = skillArticle(page);
    await article.waitFor({ state: "visible", timeout: 30_000 });
    await click(
      page,
      article.getByRole("button", { name: "Reuse", exact: true })
    );
    await article.locator(".reuse-benchmark").waitFor({
      state: "visible",
      timeout: 30_000
    });
    await show(page, article);
  });

  await runStep(page, 5, async () => {
    await setLabel(
      page,
      "REAL W7900 API RESTART · SAME RUNTIME IDENTITY"
    );
    await restartRemoteApi("Qwen/Qwen3-4B-Instruct-2507");
    await page.reload({ waitUntil: "domcontentloaded" });
    await click(
      page,
      page.getByRole("button", { name: "Memory", exact: true })
    );
    const article = skillArticle(page);
    await article.getByText("proof compatible", { exact: false }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await show(page, article);
  });

  await runStep(page, 6, async () => {
    await setLabel(
      page,
      "REAL W7900 API RESTART · RUNTIME IDENTITY DRIFT"
    );
    await restartRemoteApi("Qwen/Qwen3-4B-Instruct-2507-runtime-drift");
    await page.reload({ waitUntil: "domcontentloaded" });
    await click(
      page,
      page.getByRole("button", { name: "Memory", exact: true })
    );
    const article = skillArticle(page);
    await article.getByText("revalidation required", { exact: false }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await article.getByRole("button", {
      name: "Revalidate",
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await show(page, article);
  });

  await runStep(page, 7, async () => {
    const article = skillArticle(page);
    await click(
      page,
      article.getByRole("button", { name: "Revalidate", exact: true })
    );
    await waitForPanel(page, ".proof-panel", "Proof");
    await page.getByText("7/7", { exact: true }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await click(
      page,
      page.getByRole("button", { name: "Memory", exact: true })
    );
    const refreshed = skillArticle(page);
    await refreshed.getByText("proof compatible", { exact: false }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await click(
      page,
      page.getByRole("button", { name: "Proof", exact: true })
    );
    const downloadPromise = page.waitForEvent("download");
    await click(
      page,
      page.getByText("Download proof package", { exact: true })
    );
    const download = await downloadPromise;
    await download.saveAs(
      path.join(outputDir, "continuous-demo-v2-proof.zip")
    );
    await setLabel(
      page,
      "CHILD PROOF DOWNLOADED · LIFECYCLE COMPLETE"
    );
    await show(page, page.locator(".proof-panel"));
  });

  await context.close();
  await browser.close();
  const rawVideo = await video.path();
  await copyFile(
    rawVideo,
    path.join(outputDir, "continuous-demo-v2-raw.webm")
  );
  await writeFile(
    path.join(outputDir, "events.json"),
    JSON.stringify(events, null, 2)
  );
  await writeFile(
    path.join(outputDir, "runtime.json"),
    JSON.stringify(
      {
        instanceId,
        remotePort,
        dataDir: remoteDataDir,
        initialModel: "Qwen/Qwen3-4B-Instruct-2507",
        driftedModel: "Qwen/Qwen3-4B-Instruct-2507-runtime-drift"
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      {
        video: path.join(outputDir, "continuous-demo-v2-raw.webm"),
        events: path.join(outputDir, "events.json"),
        proof: path.join(outputDir, "continuous-demo-v2-proof.zip")
      },
      null,
      2
    )
  );
} finally {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
  if (viteProcess) viteProcess.kill("SIGTERM");
  if (!manageRemoteStack && tunnelUrl) {
    await shutdownExternalStack().catch((error) => {
      console.error(`External cleanup warning: ${error.message}`);
    });
  } else if (terminalCreated) {
    await cleanupRemoteStack().catch((error) => {
      console.error(`Remote cleanup warning: ${error.message}`);
    });
  }
}

async function createTerminal() {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(
        `${jupyterBase}/api/terminals?token=${jupyterToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: terminalName }),
          signal: AbortSignal.timeout(30_000)
        }
      );
      if (response.ok) return;
      lastError = new Error(
        `Unable to create Radeon terminal: ${response.status}`
      );
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
  throw lastError || new Error("Unable to create Radeon terminal");
}

async function setupRemoteStack() {
  const command = [
    "set -e",
    `cd ${shellQuote(remoteRepo)}`,
    "test -x ./node_modules/.bin/tsx",
    apiStartCommand("Qwen/Qwen3-4B-Instruct-2507"),
    `: > ${shellQuote(tunnelLog)}`,
    `nohup /workspace/cloudflared tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:${remotePort} >${shellQuote(tunnelLog)} 2>&1 </dev/null &`,
    `echo $! > ${shellQuote(tunnelPidFile)}`,
    "URL=''",
    `for i in $(seq 1 100); do URL=$(grep -Eo 'https://[-a-z0-9]+\\.trycloudflare\\.com' ${shellQuote(tunnelLog)} | tail -1 || true); [ -n "$URL" ] && break; sleep .5; done`,
    'test -n "$URL"',
    'echo "TUNNEL_URL=$URL"'
  ].join("; ");
  const output = await remoteCommand(command, 240_000);
  const match = output.match(
    /TUNNEL_URL=(https:\/\/[-a-z0-9]+\.trycloudflare\.com)/
  );
  if (!match) throw new Error("Isolated Radeon Tunnel URL was not returned");
  return match[1];
}

async function startLocalFrontend(apiOrigin) {
  const child = spawn(
    "./node_modules/.bin/vite",
    ["--host", "127.0.0.1", "--port", String(localPort)],
    {
      cwd: root,
      env: {
        ...process.env,
        RVSF_API_PROXY_TARGET: apiOrigin,
        RVSF_API_PROXY_TOKEN: apiToken
      },
      stdio: ["ignore", "ignore", "pipe"]
    }
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(5_000)
      });
      if (response.ok) return child;
    } catch {
      // Local frontend or isolated API is still converging.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill("SIGTERM");
  throw new Error(
    stderr.trim() || "Local continuous Demo V2 frontend did not start"
  );
}

function apiStartCommand(model) {
  return [
    [
      `nohup env PORT=${remotePort} HOST=127.0.0.1`,
      `RVSF_API_TOKEN=${shellQuote(apiToken)}`,
      "RADEON_OPENAI_BASE_URL=http://127.0.0.1:8000/v1",
      `RADEON_MODEL=${shellQuote(model)}`,
      "RADEON_ASR_BASE_URL=http://127.0.0.1:8001",
      "RADEON_ASR_MODEL=Qwen/Qwen3-ASR-0.6B",
      `RADEON_GPU_NAME=${shellQuote("AMD Radeon Pro W7900-class gfx1100 48GB")}`,
      `ROCM_VERSION=${shellQuote("ROCm 7.2.1")}`,
      "RADEON_ASR_RTF=0.0556",
    "RADEON_ASR_X_REALTIME=17.98",
    "RADEON_ASR_PEAK_VRAM_GIB=1.752",
    "RVSF_DEMO_CONTROL=1",
    `RVSF_DEMO_TUNNEL_PID_FILE=${shellQuote(tunnelPidFile)}`,
    `RVSF_DATA_DIR=${shellQuote(remoteDataDir)}`,
      "./node_modules/.bin/tsx server/index.ts",
      `>${shellQuote(apiLog)} 2>&1 </dev/null &`
    ].join(" "),
    `echo $! > ${shellQuote(apiPidFile)}`,
    `for i in $(seq 1 60); do code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 -H ${shellQuote(`x-rvsf-api-token: ${apiToken}`)} http://127.0.0.1:${remotePort}/api/health || true); [ "$code" = "200" ] && break; sleep .5; done`,
    'test "$code" = "200"'
  ].join("; ");
}

async function restartRemoteApi(model) {
  if (!manageRemoteStack) {
    const response = await fetch(`${baseUrl}/api/demo-control/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      throw new Error(
        `Isolated demo restart failed with ${response.status}`
      );
    }
    await waitForLocalHealth();
    return;
  }
  const command = [
    "set -e",
    `if [ -s ${shellQuote(apiPidFile)} ]; then kill $(cat ${shellQuote(apiPidFile)}) 2>/dev/null || true; sleep 1; fi`,
    `cd ${shellQuote(remoteRepo)}`,
    apiStartCommand(model)
  ].join("; ");
  await remoteCommand(command, 90_000);
  await waitForPublicHealth(tunnelUrl);
}

async function waitForLocalHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(5_000)
      });
      if (response.ok) return;
    } catch {
      // API is restarting behind the stable Vite frontend.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Isolated API did not recover after restart");
}

async function cleanupRemoteStack() {
  const command = [
    `if [ -s ${shellQuote(tunnelPidFile)} ]; then kill $(cat ${shellQuote(tunnelPidFile)}) 2>/dev/null || true; fi`,
    `if [ -s ${shellQuote(apiPidFile)} ]; then kill $(cat ${shellQuote(apiPidFile)}) 2>/dev/null || true; fi`
  ].join("; ");
  await remoteCommand(command, 30_000);
}

async function shutdownExternalStack() {
  const response = await fetch(`${tunnelUrl}/api/demo-control/shutdown`, {
    method: "POST",
    headers: { "x-rvsf-api-token": apiToken },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    throw new Error(`Isolated demo shutdown failed with ${response.status}`);
  }
}

function remoteCommand(command, timeoutMs) {
  return retryRemoteCommand(command, timeoutMs);
}

async function retryRemoteCommand(command, timeoutMs) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await runRemoteCommandOnce(command, timeoutMs);
    } catch (error) {
      lastError = error;
      const retryable =
        /terminal websocket failed|terminal command timed out/i.test(
          error.message
        );
      if (!retryable || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError;
}

function runRemoteCommandOnce(command, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["tmp/jupyter-terminal-exec.mjs", command], {
      cwd: root,
      env: {
        ...process.env,
        JUPYTER_TERMINAL: terminalName,
        RADEON_INSTANCE: instanceId,
        TERMINAL_TIMEOUT_MS: String(timeoutMs)
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `Remote command exited ${code}`));
    });
  });
}

async function waitForPublicHealth(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`, {
        headers: { "x-rvsf-api-token": apiToken },
        signal: AbortSignal.timeout(5_000)
      });
      if (response.ok) return;
    } catch {
      // Tunnel or API is still converging.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("Isolated public Radeon API did not become healthy");
}

async function loadDurations() {
  try {
    const parsed = JSON.parse(await readFile(timingPath, "utf8"));
    return labels.map(
      (_label, index) =>
        Math.max(
          defaultDurations[index],
          Number(parsed[index]?.duration || 0) + 2.5
        )
    );
  } catch {
    return defaultDurations;
  }
}

async function runStep(page, index, action) {
  console.log(`STEP ${index + 1}/${labels.length}: ${labels[index]}`);
  const started = elapsed();
  await setLabel(
    page,
    `ISOLATED W7900 LIFECYCLE · ${index + 1}/${labels.length} · ${labels[index]}`
  );
  await action();
  const usedMs = elapsed() - started;
  await page.waitForTimeout(
    Math.max(900, durations[index] * 1_000 - usedMs)
  );
  events.push({
    index: index + 1,
    label: labels[index],
    startMs: started,
    endMs: elapsed()
  });
  console.log(`DONE ${index + 1}/${labels.length}`);
}

async function waitForPanel(page, selector, moduleName) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await page.locator(selector).isVisible()) return;
    const moduleButton = page.getByRole("button", {
      name: moduleName,
      exact: true
    });
    const status = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".badge"))
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
    );
    if (
      (moduleName === "Policy" && status.includes("compiled")) ||
      (moduleName === "Proof" && status.includes("verified"))
    ) {
      if ((await moduleButton.count()) === 1) await moduleButton.click();
    }
    const error = await page
      .locator(".module-error")
      .textContent()
      .catch(() => "");
    if (error) throw new Error(`${moduleName} transition failed: ${error}`);
    await page.waitForTimeout(800);
  }
  throw new Error(`${moduleName} module did not appear`);
}

function skillArticle(page) {
  return page
    .locator(".skill-memory-list article")
    .filter({ hasText: projectName })
    .first();
}

async function setLabel(page, text) {
  await page.evaluate((labelText) => {
    const label = document.getElementById("continuous-v2-label");
    if (label) label.textContent = labelText;
  }, text);
}

async function click(page, locator) {
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
      { steps: 18 }
    );
    await page.waitForTimeout(280);
  }
  await locator.click();
  await page.waitForTimeout(520);
}

async function show(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(750);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function elapsed() {
  return Date.now() - recordingStartedAt;
}
