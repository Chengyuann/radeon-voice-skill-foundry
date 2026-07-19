import { createRequire } from "node:module";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baseUrl =
  process.env.DEMO_V2_URL ||
  "https://radeon-voice-skill-foundry.pages.dev/";
const outputDir = path.join(root, "tmp", "demo-v2", "recording");
const rawDir = path.join(outputDir, "raw");
const audioPath =
  process.env.DEMO_V2_AUDIO ||
  path.join(root, "outputs", "audio", "voice-sop-zh.wav");
const timingPath = path.join(
  root,
  "tmp",
  "demo-v2",
  "narration",
  "timings.json"
);
const projectName = "review-followup-live-v2";
const labels = [
  "Open the live Radeon product",
  "Capture source-bound voice",
  "Compile on Radeon",
  "Inspect enforced policy",
  "Prove unsafe paths",
  "Save and reuse memory",
  "Show W7900 evidence",
  "Close on the public demo"
];
const defaultDurations = [22, 32, 44, 27, 28, 26, 28, 20];
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

await rm(outputDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });

try {
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
    acceptDownloads: true
  });
  await context.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const label = document.createElement("div");
      label.id = "demo-v2-label";
      label.style.cssText =
        "position:fixed;z-index:2147483646;left:30px;top:88px;" +
        "max-width:620px;padding:11px 15px;color:#f7f9fa;" +
        "background:#202224e8;border-left:4px solid #c23a35;" +
        "font:600 16px 'Geist Mono',monospace;letter-spacing:0;" +
        "box-shadow:0 12px 32px #0007;pointer-events:none;";
      label.textContent = "LIVE CLOUDFLARE + W7900";

      const cursor = document.createElement("div");
      cursor.id = "demo-v2-cursor";
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
    await page.mouse.move(1450, 420, { steps: 24 });
  });

  await runStep(page, 1, async () => {
    await click(
      page,
      page.getByRole("button", { name: "Voice", exact: true })
    );
    await page.getByLabel("Skill name").fill(projectName);
    await page.locator('input[type="file"]').setInputFiles(audioPath);
    await page.getByText("Voice Evidence Gate", { exact: true }).waitFor({
      state: "visible",
      timeout: 60_000
    });
    await page.getByText("No acoustic diagnostics triggered.", {
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await completeDemonstration(page);
    await show(page, page.locator(".voice-evidence"));
  });

  await runStep(page, 2, async () => {
    await click(
      page,
      page.getByRole("button", { name: "Compile voice + actions", exact: true })
    );
    await waitForPolicy(page);
    await show(page, page.locator(".constraint-panel"));
  });

  await runStep(page, 3, async () => {
    await page.getByText("Automatic send is blocked", {
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await show(page, page.getByText("mail:send", { exact: true }));
    await page.mouse.move(1480, 500, { steps: 20 });
  });

  await runStep(page, 4, async () => {
    await click(
      page,
      page.getByRole("button", {
        name: "Run local verification",
        exact: true
      })
    );
    await waitForProof(page);
    await page.getByText("7/7", { exact: true }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await show(page, page.locator(".proof-panel"));
  });

  await runStep(page, 5, async () => {
    const downloadPromise = page.waitForEvent("download");
    await click(
      page,
      page.getByText("Download proof package", { exact: true })
    );
    const download = await downloadPromise;
    await download.saveAs(path.join(outputDir, "demo-v2-proof.zip"));

    await click(
      page,
      page.getByRole("button", { name: "Save verified skill", exact: true })
    );
    await page.waitForSelector(".memory-panel", { timeout: 30_000 });
    const article = page
      .locator(".skill-memory-list article")
      .filter({ hasText: projectName });
    if ((await article.count()) < 1) {
      throw new Error("Saved Demo V2 skill was not found in memory");
    }
    const reuse = article.first().getByRole("button", {
      name: "Reuse",
      exact: true
    });
    await click(page, reuse);
    await article.first().locator(".reuse-benchmark").waitFor({
      state: "visible",
      timeout: 30_000
    });
    await show(page, article.first());
  });

  await runStep(page, 6, async () => {
    await page.evaluate(() => {
      const existing = document.getElementById("demo-v2-evidence");
      if (existing) existing.remove();
      const overlay = document.createElement("section");
      overlay.id = "demo-v2-evidence";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483644;padding:120px 8vw 90px;" +
        "display:grid;grid-template-rows:auto 1fr auto;gap:42px;" +
        "color:#f7f9fa;background:#181b1ddd;font-family:Manrope,sans-serif;" +
        "backdrop-filter:blur(22px);";
      overlay.innerHTML = `
        <header style="display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #ffffff2e;padding-bottom:24px">
          <div>
            <p style="margin:0 0 8px;color:#df7a74;font:600 14px 'Geist Mono',monospace">MEASURED W7900 EVIDENCE · ROCm 7.2.1</p>
            <h2 style="margin:0;font:600 64px Kanit,sans-serif;text-transform:uppercase">Optimization ceiling</h2>
          </div>
          <p style="margin:0;color:#b7bec2;font:500 17px 'Geist Mono',monospace">gfx1100 · 48 GB VRAM</p>
        </header>
        <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:18px;align-items:stretch">
          <article style="padding:34px;border:1px solid #ffffff26;background:#24282acc;display:grid;align-content:space-between">
            <span style="color:#aeb5b8;font:600 13px 'Geist Mono',monospace">vLLM GRAPH · CONCURRENCY 8</span>
            <strong style="font:600 76px Kanit,sans-serif">257.65</strong>
            <span style="font:500 22px 'Geist Mono',monospace">aggregate output tok/s</span>
          </article>
          <article style="padding:34px;border:1px solid #ffffff26;background:#24282acc;display:grid;align-content:space-between">
            <span style="color:#aeb5b8;font:600 13px 'Geist Mono',monospace">SERVING UPLIFT</span>
            <strong style="font:600 72px Kanit,sans-serif;color:#df7a74">12.47x</strong>
            <span style="font:500 18px 'Geist Mono',monospace">vs serialized Transformers</span>
          </article>
          <article style="padding:34px;border:1px solid #ffffff26;background:#24282acc;display:grid;align-content:space-between">
            <span style="color:#aeb5b8;font:600 13px 'Geist Mono',monospace">QWEN3-ASR · BATCH 8</span>
            <strong style="font:600 72px Kanit,sans-serif;color:#79b493">85.35x</strong>
            <span style="font:500 18px 'Geist Mono',monospace">aggregate real-time</span>
          </article>
        </div>
        <footer style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ffffff2e;padding-top:22px;color:#c9ced1">
          <span style="font:500 17px 'Geist Mono',monospace">35/35 regression tests · Voice Evidence v0.3 · 7/7 proof</span>
          <span style="font:500 17px 'Geist Mono',monospace">weekend-w7900-v10-evidence.zip</span>
        </footer>`;
      document.body.append(overlay);
    });
    await page.mouse.move(960, 540, { steps: 18 });
  });

  await runStep(page, 7, async () => {
    await page.evaluate(() => {
      document.getElementById("demo-v2-evidence")?.remove();
    });
    await click(page, page.getByRole("button", { name: "Cover", exact: true }));
    await page.waitForSelector(".cinematic-hero", { timeout: 20_000 });
    await page.evaluate(() => {
      const label = document.getElementById("demo-v2-label");
      if (label) {
        label.textContent =
          "LIVE DEMO · radeon-voice-skill-foundry.pages.dev";
      }
    });
    await page.mouse.move(1520, 430, { steps: 24 });
  });

  await context.close();
  await browser.close();
  const rawVideo = await video.path();
  await copyFile(rawVideo, path.join(outputDir, "demo-v2-raw.webm"));
  await writeFile(
    path.join(outputDir, "events.json"),
    JSON.stringify(events, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        video: path.join(outputDir, "demo-v2-raw.webm"),
        events: path.join(outputDir, "events.json"),
        proof: path.join(outputDir, "demo-v2-proof.zip")
      },
      null,
      2
    )
  );
} finally {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
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
  await page.evaluate(
    ({ current, total, text }) => {
      const label = document.getElementById("demo-v2-label");
      if (label) {
        label.textContent =
          `LIVE CLOUDFLARE + W7900 · ${current}/${total} · ${text}`;
      }
    },
    { current: index + 1, total: labels.length, text: labels[index] }
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

async function waitForPolicy(page) {
  let retried = false;
  const deadline = Date.now() + 140_000;
  while (Date.now() < deadline) {
    if (await page.locator(".constraint-panel").isVisible()) return;
    const state = await page.evaluate(() => ({
      compiled: Array.from(document.querySelectorAll(".badge")).some(
        (node) => node.textContent?.trim() === "compiled"
      ),
      error: document.querySelector(".module-error")?.textContent || ""
    }));
    if (state.compiled) {
      const policy = page.getByRole("button", {
        name: "Policy",
        exact: true
      });
      if ((await policy.count()) === 1) {
        await policy.click();
      }
    } else if (state.error && !retried) {
      retried = true;
      await dismissError(page);
      await click(
        page,
        page.getByRole("button", {
          name: "Compile voice + actions",
          exact: true
        })
      );
    } else if (state.error) {
      throw new Error(`Public compile failed: ${state.error}`);
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error("Policy module did not appear after public compilation");
}

async function completeDemonstration(page) {
  for (const name of [
    "Open review",
    "P0/P1 only",
    "Review owner",
    "Draft email",
    "Draft holds",
    "Export report"
  ]) {
    await click(page, page.getByRole("button", { name, exact: true }));
  }
  await page.getByText("Demonstration contract captured", {
    exact: true
  }).waitFor({ state: "visible", timeout: 30_000 });
}

async function waitForProof(page) {
  let retried = false;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await page.locator(".proof-panel").isVisible()) return;
    const error = await page
      .locator(".module-error")
      .textContent()
      .catch(() => "");
    if (error && !retried) {
      retried = true;
      await dismissError(page);
      await click(
        page,
        page.getByRole("button", {
          name: "Run local verification",
          exact: true
        })
      );
    } else if (error) {
      throw new Error(`Public verification failed: ${error}`);
    }
    await page.waitForTimeout(800);
  }
  throw new Error("Proof module did not appear after verification");
}

async function dismissError(page) {
  const dismiss = page.getByRole("button", {
    name: "Dismiss",
    exact: true
  });
  if ((await dismiss.count()) === 1) {
    await dismiss.click();
    await page.waitForTimeout(400);
  }
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

function elapsed() {
  return Date.now() - recordingStartedAt;
}
