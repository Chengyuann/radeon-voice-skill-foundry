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
  process.env.DEMO_V3_URL ||
  "https://radeon-voice-skill-foundry.pages.dev/";
const outputDir = path.join(root, "tmp", "demo-v3", "recording");
const rawDir = path.join(outputDir, "raw");
const audioPath =
  process.env.DEMO_V3_AUDIO ||
  path.join(root, "outputs", "audio", "voice-sop-zh.wav");
const timingPath = path.join(
  root,
  "tmp",
  "demo-v3",
  "narration",
  "timings.json"
);
const projectName =
  process.env.DEMO_V3_PROJECT || "review-followup-final-demo-v3";
const labels = [
  "Open the frozen public product",
  "Capture voice and trusted actions",
  "Compile on Radeon",
  "Verify policy and Sandbox Replay",
  "Review and promote the candidate",
  "Inspect and export the audit ledger",
  "Reuse the identical promoted skill",
  "Close on the stable public product"
];
const defaultDurations = [24, 48, 36, 38, 36, 38, 30, 20];
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
    acceptDownloads: true,
    reducedMotion: "reduce"
  });
  await context.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const label = document.createElement("div");
      label.id = "demo-v3-label";
      label.style.cssText =
        "position:fixed;z-index:2147483646;left:30px;top:88px;" +
        "max-width:680px;padding:11px 15px;color:#f7f9fa;" +
        "background:#202224e8;border-left:4px solid #c23a35;" +
        "font:600 16px 'Geist Mono',monospace;letter-spacing:0;" +
        "box-shadow:0 12px 32px #0007;pointer-events:none;";
      label.textContent = "FINAL DEMO V3 · LIVE CLOUDFLARE + W7900";

      const cursor = document.createElement("div");
      cursor.id = "demo-v3-cursor";
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
      timeout: 90_000
    });
    await page.getByText("No acoustic diagnostics triggered.", {
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await completeDemonstration(page);
    await show(page, page.locator(".demo-workspace"));
  });

  await runStep(page, 2, async () => {
    await click(
      page,
      page.getByRole("button", {
        name: "Compile voice + actions",
        exact: true
      })
    );
    await waitForPolicy(page);
    await show(page, page.locator(".constraint-panel"));
  });

  await runStep(page, 3, async () => {
    await page.getByText("Automatic send is blocked", {
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await show(page, page.getByText("mail:send", { exact: true }));
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
    const downloadPromise = page.waitForEvent("download");
    await click(
      page,
      page.getByText("Download proof package", { exact: true })
    );
    const download = await downloadPromise;
    await download.saveAs(path.join(outputDir, "demo-v3-proof.zip"));
    await show(page, page.locator(".proof-panel"));
  });

  await runStep(page, 4, async () => {
    await click(
      page,
      page.getByRole("button", {
        name: "Save verified candidate",
        exact: true
      })
    );
    await page.waitForSelector(".memory-panel", { timeout: 30_000 });
    const article = skillArticle(page);
    await article.getByText("candidate", { exact: true }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await click(
      page,
      article.getByRole("button", {
        name: "Review & promote",
        exact: true
      })
    );
    await article.getByText("Promotion impact review", {
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await show(page, article.locator(".promotion-review"));
    const acknowledgement = article.getByRole("checkbox");
    if ((await acknowledgement.count()) === 1) {
      await click(page, acknowledgement);
    }
    await page.waitForTimeout(3_000);
    await click(
      page,
      article.getByRole("button", {
        name: "Approve promotion",
        exact: true
      })
    );
    await article.getByText("promoted", { exact: true }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    await show(page, article);
  });

  await runStep(page, 5, async () => {
    await click(
      page,
      page.getByRole("button", {
        name: "Open governance audit ledger",
        exact: true
      })
    );
    await page.getByText("Governance audit ledger", {
      exact: true
    }).waitFor({ state: "visible", timeout: 30_000 });
    await page.getByText("valid", { exact: true }).waitFor({
      state: "visible",
      timeout: 30_000
    });
    const ledgerDownload = page.waitForEvent("download");
    await click(page, page.getByText("Export JSONL", { exact: true }));
    const ledger = await ledgerDownload;
    await ledger.saveAs(path.join(outputDir, "governance-ledger.jsonl"));
    await show(page, page.locator(".governance-ledger"));
  });

  await runStep(page, 6, async () => {
    const article = skillArticle(page);
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

  await runStep(page, 7, async () => {
    await click(page, page.getByRole("button", { name: "Cover", exact: true }));
    await page.waitForSelector(".cinematic-hero", { timeout: 20_000 });
    await page.evaluate(() => {
      const label = document.getElementById("demo-v3-label");
      if (label) {
        label.textContent =
          "FINAL DEMO V3 · radeon-voice-skill-foundry.pages.dev";
      }
    });
    await page.mouse.move(1520, 430, { steps: 24 });
  });

  await context.close();
  await browser.close();
  const rawVideo = await video.path();
  await copyFile(rawVideo, path.join(outputDir, "demo-v3-raw.webm"));
  await writeFile(
    path.join(outputDir, "events.json"),
    JSON.stringify(events, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        projectName,
        video: path.join(outputDir, "demo-v3-raw.webm"),
        events: path.join(outputDir, "events.json"),
        proof: path.join(outputDir, "demo-v3-proof.zip"),
        ledger: path.join(outputDir, "governance-ledger.jsonl")
      },
      null,
      2
    )
  );
} finally {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
}

function skillArticle(page) {
  return page
    .locator(".skill-memory-list article")
    .filter({ hasText: projectName })
    .first();
}

async function loadDurations() {
  try {
    const parsed = JSON.parse(await readFile(timingPath, "utf8"));
    return labels.map(
      (_label, index) =>
        Math.max(
          defaultDurations[index],
          Number(parsed[index]?.duration || 0) + 3
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
      const label = document.getElementById("demo-v3-label");
      if (label) {
        label.textContent =
          `FINAL DEMO V3 · LIVE CLOUDFLARE + W7900 · ${current}/${total} · ${text}`;
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
  const deadline = Date.now() + 160_000;
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
  const deadline = Date.now() + 75_000;
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
