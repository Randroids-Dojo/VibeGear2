import { expect, test } from "@playwright/test";

test.describe("title screen", () => {
  test("renders the game title and disabled menu", async ({ page }) => {
    await page.goto("/");

    const title = page.getByTestId("game-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("VibeGear2");

    await expect(page).toHaveTitle(/VibeGear2/);

    for (const label of ["Start Race", "Garage", "Options"]) {
      const button = page.getByRole("button", { name: label });
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
    }

    await expect(page.getByTestId("build-status")).toContainText("Phase 0");
  });
});
