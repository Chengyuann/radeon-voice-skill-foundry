import { createRequire } from "node:module";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baseUrl = process.env.MULTI_TURN_DEMO_URL || "http://127.0.0.1:5173/";
const outputDir = path.join(root, "tmp", "multi-turn-demo");
const rawDir = path.join(outputDir, "raw");
const projectName = `multi-turn-demo-${Date.now().toString(36)}`;
const nodeModules =
  process.env.CODEX_NODE_MODULES ||
  "/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledRequire = createRequire(path.join(nodeModules, "package.json"));
const { chromium } = bundledRequire("playwright");

const events = [];
let browser;
let context;

await rm(outputDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });

try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--disable-gpu", "--disable-dev-shm-usage"]
  });
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1440, height: 900 }
    },
    reducedMotion: "reduce"
  });
  await context.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      const label = document.createElement("div");
      label.id = "multi-turn-demo-label";
      label.style.cssText =
        "position:fixed;z-index:2147483646;left:24px;top:84px;" +
        "max-width:620px;padding:10px 14px;color:white;" +
        "background:#202224ee;border-left:5px solid #c23a35;" +
        "font:700 16px Arial;box-shadow:0 8px 24px #0007;" +
        "pointer-events:none;";
      label.textContent = "Multi-turn supplement";
      document.body.append(label);
    });
  });

  const page = await context.newPage();
  const video = page.video();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Voice", exact: true }).click();
  await page.getByLabel("Skill name").fill(projectName);

  await mark(page, "1/5 · Compile baseline spoken SOP");
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
  await page.getByRole("button", {
    name: "Compile voice + actions",
    exact: true
  }).click();
  await page.getByText("Multi-turn policy conversation", {
    exact: true
  }).waitFor({ timeout: 30_000 });
  await show(page, page.locator(".revision-session"));
  await hold(page, 3_000);

  await mark(page, "2/5 · Natural-language correction creates revision 2");
  await page
    .getByLabel("Policy correction")
    .fill("Always require confirmation before creating calendar holds.");
  await page.getByRole("button", { name: "Create revision 2", exact: true }).click();
  await page.getByText("Operator correction 1", { exact: true }).waitFor({
    timeout: 30_000
  });
  await show(page, page.locator(".revision-session"));
  await hold(page, 5_000);

  await mark(page, "3/5 · Verify child proof; revision 2 becomes verified");
  await page.getByRole("button", { name: "Run local verification", exact: true }).click();
  await page.getByRole("button", { name: "Policy", exact: true }).click();
  await page.getByText("Current revision has a proof", { exact: true }).waitFor({
    timeout: 30_000
  });
  await show(page, page.locator(".revision-session"));
  await hold(page, 5_000);

  await mark(page, "4/5 · Another correction creates revision 3");
  await page
    .getByLabel("Policy correction")
    .fill("Never send drafted emails without explicit human approval.");
  await page.getByRole("button", { name: "Create revision 3", exact: true }).click();
  await page.getByText("Operator correction 2", { exact: true }).waitFor({
    timeout: 30_000
  });
  await show(page, page.locator(".revision-session"));
  await hold(page, 7_000);

  await mark(page, "5/5 · New child is compiled; verification is required again");
  await show(page, page.locator(".revision-composer"));
  await hold(page, 6_000);

  await page.screenshot({
    path: path.join(outputDir, "MULTI_TURN_SUPPLEMENT.png"),
    fullPage: false
  });

  await context.close();
  await browser.close();
  const rawVideo = await video.path();
  await copyFile(rawVideo, path.join(outputDir, "multi-turn-supplement-raw.webm"));
  await writeFile(
    path.join(outputDir, "events.json"),
    JSON.stringify(events, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        rawVideo: path.join(outputDir, "multi-turn-supplement-raw.webm"),
        screenshot: path.join(outputDir, "MULTI_TURN_SUPPLEMENT.png"),
        events: path.join(outputDir, "events.json")
      },
      null,
      2
    )
  );
} finally {
  if (context) await context.close().catch(() => undefined);
  if (browser) await browser.close().catch(() => undefined);
}

async function mark(page, text) {
  const started = Date.now();
  await page.evaluate((labelText) => {
    const label = document.getElementById("multi-turn-demo-label");
    if (label) label.textContent = labelText;
  }, text);
  events.push({ text, startedAtMs: started });
}

async function show(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}

async function hold(page, milliseconds) {
  await page.waitForTimeout(milliseconds);
  const event = events.at(-1);
  if (event) event.endedAtMs = Date.now();
}
