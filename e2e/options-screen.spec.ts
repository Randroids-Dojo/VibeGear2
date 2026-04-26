import { expect, test } from "@playwright/test";

const TAB_KEYS = [
  "display",
  "audio",
  "controls",
  "accessibility",
  "difficulty",
  "performance",
  "profile",
] as const;

test.describe("options screen", () => {
  test("renders every tab and opens with Display selected", async ({ page }) => {
    await page.goto("/options");

    await expect(page.getByTestId("options-page")).toBeVisible();

    for (const key of TAB_KEYS) {
      await expect(page.getByTestId(`options-tab-${key}`)).toBeVisible();
    }

    await expect(page.getByTestId("options-tab-display")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("options-panel-display")).toBeVisible();
    await expect(page.getByTestId("options-panel-display-dot")).toContainText(
      "VibeGear2-implement-visual-polish-7d31d112",
    );
  });

  test("ArrowRight cycles through tabs and wraps", async ({ page }) => {
    await page.goto("/options");

    const display = page.getByTestId("options-tab-display");
    await display.focus();

    // Step through Audio, Controls, Accessibility, Difficulty,
    // Performance, Profile, then wrap back to Display.
    const order = [
      "audio",
      "controls",
      "accessibility",
      "difficulty",
      "performance",
      "profile",
      "display",
    ];
    for (const key of order) {
      await page.keyboard.press("ArrowRight");
      await expect(page.getByTestId(`options-tab-${key}`)).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.getByTestId(`options-panel-${key}`)).toBeVisible();
    }
  });

  test("ArrowLeft wraps from first tab to last", async ({ page }) => {
    await page.goto("/options");

    await page.getByTestId("options-tab-display").focus();
    await page.keyboard.press("ArrowLeft");

    await expect(page.getByTestId("options-tab-profile")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("Reset to defaults is disabled and cites the reset wiring followup", async ({ page }) => {
    await page.goto("/options");

    const reset = page.getByTestId("options-reset-defaults");
    await expect(reset).toBeVisible();
    await expect(reset).toBeDisabled();
    await expect(reset).toHaveAttribute(
      "title",
      /F-049/,
    );
  });

  test("Back to title link returns to /", async ({ page }) => {
    await page.goto("/options");
    await page.getByTestId("options-back").click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Escape returns to the title screen", async ({ page }) => {
    // Navigate via the title menu so history.back has a referrer.
    await page.goto("/");
    await page.getByTestId("menu-options").click();
    await expect(page).toHaveURL(/\/options$/);

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("game-title")).toBeVisible();
  });
});
