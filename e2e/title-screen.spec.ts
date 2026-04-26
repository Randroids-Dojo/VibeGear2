import { expect, test } from "@playwright/test";

test.describe("title screen", () => {
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

    const garage = page.getByTestId("menu-garage");
    await expect(garage).toBeVisible();
    await expect(garage).toHaveText("Garage");
    await expect(garage).toHaveAttribute("href", "/garage/cars");

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

  test("Garage link navigates to /garage/cars", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-garage").click();
    await expect(page).toHaveURL(/\/garage\/cars$/);
  });

  test("Options link navigates to /options", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("menu-options").click();
    await expect(page).toHaveURL(/\/options$/);
  });
});
