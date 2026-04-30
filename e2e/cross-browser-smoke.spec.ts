import { expect, test, type Page } from "@playwright/test";

const CORE_ROUTES: ReadonlyArray<{
  readonly path: string;
  readonly testId: string;
}> = [
  { path: "/", testId: "game-title" },
  { path: "/options", testId: "options-page" },
  { path: "/garage", testId: "garage-page" },
  { path: "/world", testId: "world-page" },
  { path: "/race?mode=practice", testId: "race-canvas" },
];

async function focusByTab(page: Page, testId: string, maxTabs = 24): Promise<void> {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press("Tab");
    const activeTestId = await page.evaluate(() => {
      const active = document.activeElement;
      return active instanceof HTMLElement ? active.dataset.testid ?? null : null;
    });
    if (activeTestId === testId) return;
  }
  throw new Error(`Could not focus ${testId} with Tab`);
}

async function canvasHasSpatialVariation(page: Page): Promise<boolean> {
  return page.getByTestId("race-canvas-element").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 64) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      colors.add(`${r >> 4}:${g >> 4}:${b >> 4}`);
      if (colors.size >= 12) return true;
    }
    return false;
  });
}

test.describe("cross-browser compatibility smoke", () => {
  test("loads core routes", async ({ page }) => {
    for (const route of CORE_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByTestId(route.testId)).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("renders a live race canvas in reduced-motion mode", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/race?mode=practice");
    await expect(page.getByTestId("race-canvas-element")).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });
    await expect(
      page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
    ).resolves.toBe(true);
    await expect.poll(() => canvasHasSpatialVariation(page)).toBe(true);
  });

  test("keeps the race surface inside a Steam Deck viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/race?mode=practice");
    await expect(page.getByTestId("race-canvas")).toBeVisible();
    const metrics = await page.getByTestId("race-canvas").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  });

  test("supports keyboard-only title to race to garage navigation", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("menu-start-race")).toBeVisible();
    await focusByTab(page, "menu-start-race");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/race(\?.*)?$/);
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();
    await focusByTab(page, "pause-exit");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("menu-garage")).toBeVisible();

    await focusByTab(page, "menu-garage");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/garage$/);
    await expect(page.getByTestId("garage-page")).toBeVisible();
  });
});
