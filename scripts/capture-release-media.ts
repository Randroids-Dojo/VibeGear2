import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium } from "@playwright/test";

type CaptureTarget = {
  id: string;
  path: string;
  readySelector: string;
  waitMs?: number;
};

const BASE_URL = process.env.RELEASE_MEDIA_BASE_URL ?? "http://127.0.0.1:3000";
const OUTPUT_DIR = process.env.RELEASE_MEDIA_OUT ?? "artifacts/release-media";
const VIEWPORT = { width: 1280, height: 720 };

const screenshotTargets: CaptureTarget[] = [
  { id: "01-title", path: "/", readySelector: "body" },
  { id: "02-world-tour", path: "/world", readySelector: "body" },
  { id: "03-race", path: "/race?mode=practice", readySelector: "canvas", waitMs: 1_000 },
  { id: "04-garage", path: "/garage", readySelector: "body" },
  { id: "05-time-trial", path: "/time-trial", readySelector: "body" },
  { id: "06-options", path: "/options", readySelector: "body" },
];

async function captureScreenshots(): Promise<string[]> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const files: string[] = [];

  for (const target of screenshotTargets) {
    await page.goto(new URL(target.path, BASE_URL).toString(), { waitUntil: "networkidle" });
    await page.locator(target.readySelector).first().waitFor({ state: "visible" });
    if (target.waitMs) await page.waitForTimeout(target.waitMs);
    const file = join(OUTPUT_DIR, "screenshots", `${target.id}.png`);
    await page.screenshot({ path: file, fullPage: false });
    files.push(file);
  }

  await context.close();
  await browser.close();
  return files;
}

async function captureTrailerClip(): Promise<string> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: join(OUTPUT_DIR, "trailer"),
      size: VIEWPORT,
    },
  });
  const page = await context.newPage();
  await page.goto(new URL("/race?mode=practice", BASE_URL).toString(), {
    waitUntil: "networkidle",
  });
  await page.locator("canvas").first().waitFor({ state: "visible" });
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(12_000);
  await page.keyboard.up("ArrowUp");

  const video = page.video();
  const file = join(OUTPUT_DIR, "trailer", "raceplay.webm");
  await page.close();
  await context.close();
  await video?.saveAs(file);
  await video?.delete();
  await browser.close();
  return file;
}

async function main(): Promise<void> {
  await rm(OUTPUT_DIR, { force: true, recursive: true });
  await mkdir(join(OUTPUT_DIR, "screenshots"), { recursive: true });
  await mkdir(join(OUTPUT_DIR, "trailer"), { recursive: true });

  const screenshots = await captureScreenshots();
  const trailer = await captureTrailerClip();
  const manifest = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: VIEWPORT,
    screenshots,
    trailer,
  };
  await writeFile(
    join(OUTPUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Captured ${screenshots.length} screenshots and 1 trailer clip in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
