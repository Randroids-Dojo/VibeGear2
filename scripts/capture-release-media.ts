import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

type CaptureTarget = {
  id: string;
  path: string;
  readySelector: string;
  waitMs?: number;
};

const BASE_URL = process.env.RELEASE_MEDIA_BASE_URL ?? "http://127.0.0.1:3000";
const OUTPUT_DIR = resolveOutputDir(process.env.RELEASE_MEDIA_OUT);
const VIEWPORT = { width: 1280, height: 720 };

const screenshotTargets: CaptureTarget[] = [
  { id: "01-title", path: "/", readySelector: "body" },
  { id: "02-world-tour", path: "/world", readySelector: "body" },
  { id: "03-race", path: "/race?mode=practice", readySelector: "canvas", waitMs: 1_000 },
  { id: "04-garage", path: "/garage", readySelector: "body" },
  { id: "05-time-trial", path: "/time-trial", readySelector: "body" },
  { id: "06-options", path: "/options", readySelector: "body" },
];

function resolveOutputDir(rawOutputDir: string | undefined): string {
  const requested = (rawOutputDir ?? "artifacts/release-media").trim();
  if (requested.length === 0) {
    throw new Error("RELEASE_MEDIA_OUT must not be empty.");
  }

  const repoRoot = process.cwd();
  const artifactsRoot = resolve(repoRoot, "artifacts");
  const resolved = resolve(repoRoot, requested);
  const rel = relative(artifactsRoot, resolved);
  if (rel.length === 0 || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      "RELEASE_MEDIA_OUT must resolve to a child directory under artifacts/.",
    );
  }
  return resolved;
}

async function captureScreenshots(): Promise<string[]> {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  const files: string[] = [];

  try {
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: VIEWPORT });
    page = await context.newPage();

    for (const target of screenshotTargets) {
      await page.goto(new URL(target.path, BASE_URL).toString(), { waitUntil: "networkidle" });
      await page.locator(target.readySelector).first().waitFor({ state: "visible" });
      if (target.waitMs) await page.waitForTimeout(target.waitMs);
      const file = join(OUTPUT_DIR, "screenshots", `${target.id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      files.push(file);
    }

    return files;
  } finally {
    await page?.close();
    await context?.close();
    await browser?.close();
  }
}

async function captureTrailerClip(): Promise<string> {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    browser = await chromium.launch();
    context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: {
        dir: join(OUTPUT_DIR, "trailer"),
        size: VIEWPORT,
      },
    });
    page = await context.newPage();
    await page.goto(new URL("/race?mode=practice", BASE_URL).toString(), {
      waitUntil: "networkidle",
    });
    await page.locator("canvas").first().waitFor({ state: "visible" });
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(12_000);
    await page.keyboard.up("ArrowUp");

    const video = page.video();
    if (!video) {
      throw new Error("Trailer capture failed: Playwright did not create a video recording.");
    }

    const file = join(OUTPUT_DIR, "trailer", "raceplay.webm");
    await page.close();
    page = undefined;
    await context.close();
    context = undefined;
    await video.saveAs(file);
    await video.delete();
    return file;
  } finally {
    await page?.close();
    await context?.close();
    await browser?.close();
  }
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
