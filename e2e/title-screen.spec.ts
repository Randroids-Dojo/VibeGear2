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

    const optionsPending = page.getByTestId("menu-options-pending");
    await expect(optionsPending).toBeVisible();
    await expect(optionsPending).toBeDisabled();

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
});
