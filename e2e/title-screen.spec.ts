import { expect, test } from "@playwright/test";

test.describe("title screen", () => {
  test("keeps the title screen centered on short mobile viewports", async ({
    page,
  }) => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 390, height: 667 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const metrics = await page.getByLabel("Title screen").evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
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
      expect(
        Math.abs(metrics.centerX - metrics.viewportWidth / 2),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(metrics.centerY - metrics.viewportHeight / 2),
      ).toBeLessThanOrEqual(12);
    }
  });

  test("renders the game title and main menu wiring", async ({ page }) => {
    await page.goto("/");

    const title = page.getByTestId("game-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("VibeGear2");

    await expect(page).toHaveTitle(/VibeGear2/);

    const startRace = page.getByTestId("menu-start-race");
    await expect(startRace).toBeVisible();
    await expect(startRace).toHaveText("Start Race");
    await expect(startRace).toHaveAttribute("href", "/race");

    const worldTour = page.getByTestId("menu-world");
    await expect(worldTour).toBeVisible();
    await expect(worldTour).toHaveText("World Tour");
    await expect(worldTour).toHaveAttribute("href", "/world");

    // Q-015 scope cut: Time Trial / Quick Race / Practice / Daily are
    // not in the v1.0 main menu. The underlying routes still resolve
    // (full deletion is queued under F-090) but no menu link points at
    // them.
    await expect(page.getByTestId("menu-time-trial")).toHaveCount(0);
    await expect(page.getByTestId("menu-quick-race")).toHaveCount(0);
    await expect(page.getByTestId("menu-practice")).toHaveCount(0);
    await expect(page.getByTestId("menu-daily")).toHaveCount(0);

    const garage = page.getByTestId("menu-garage");
    await expect(garage).toBeVisible();
    await expect(garage).toHaveText("Garage");
    await expect(garage).toHaveAttribute("href", "/garage");

    const options = page.getByTestId("menu-options");
    await expect(options).toBeVisible();
    await expect(options).toHaveText("Options");
    await expect(options).toHaveAttribute("href", "/options");

    await expect(page.getByTestId("build-status")).toContainText("Phase 0");
  });

  test("Start Race link navigates to /race", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-start-race").click();
    await expect(page).toHaveURL(/\/race(\?.*)?$/);
  });

  test("Garage link navigates to /garage", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-garage").click();
    await expect(page).toHaveURL(/\/garage$/);
  });

  test("World Tour link navigates to /world", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-world").click();
    await expect(page).toHaveURL(/\/world$/);
    await expect(page.getByTestId("world-page")).toBeVisible();
  });

  test("Options link navigates to /options", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-options").click();
    await expect(page).toHaveURL(/\/options$/);
  });
});
