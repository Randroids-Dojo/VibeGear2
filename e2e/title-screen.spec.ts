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

    const timeTrial = page.getByTestId("menu-time-trial");
    await expect(timeTrial).toBeVisible();
    await expect(timeTrial).toHaveText("Time Trial");
    await expect(timeTrial).toHaveAttribute("href", "/time-trial");

    const quickRace = page.getByTestId("menu-quick-race");
    await expect(quickRace).toBeVisible();
    await expect(quickRace).toHaveText("Quick Race");
    await expect(quickRace).toHaveAttribute("href", "/quick-race");

    const practice = page.getByTestId("menu-practice");
    await expect(practice).toBeVisible();
    await expect(practice).toHaveText("Practice");
    await expect(practice).toHaveAttribute("href", "/race?mode=practice");

    const daily = page.getByTestId("menu-daily");
    await expect(daily).toBeVisible();
    await expect(daily).toHaveText("Daily Challenge");
    await expect(daily).toHaveAttribute("href", "/daily");

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

  test("Time Trial link navigates to time-trial race mode", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-time-trial").click();
    await expect(page).toHaveURL(/\/race\?mode=timeTrial$/);
    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-mode",
      "timeTrial",
    );
  });

  test("Quick Race link navigates to quick-race picker", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-quick-race").click();
    await expect(page).toHaveURL(/\/quick-race$/);
    await expect(page.getByTestId("quick-race-page")).toBeVisible();
    await expect(page.getByTestId("quick-race-start")).toHaveAttribute(
      "href",
      /\/race\?mode=quickRace&track=.+&weather=.+&car=.+/,
    );
  });

  test("Practice link navigates to practice race mode", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-practice").click();
    await expect(page).toHaveURL(/\/race\?mode=practice$/);
    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-mode",
      "practice",
    );
    await expect(page.getByTestId("practice-panel")).toBeVisible();
  });

  test("Daily Challenge link navigates to /daily", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-daily").click();
    await expect(page).toHaveURL(/\/daily$/);
    await expect(page.getByTestId("daily-page")).toBeVisible();
    await expect(page.getByTestId("daily-start")).toHaveAttribute(
      "href",
      /\/race\?mode=timeTrial&track=.+&weather=.+/,
    );
  });

  test("Options link navigates to /options", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-options").click();
    await expect(page).toHaveURL(/\/options$/);
  });
});
