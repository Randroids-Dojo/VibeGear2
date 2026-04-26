import { expect, test } from "@playwright/test";

/**
 * Accessibility assist toggles in /options Accessibility pane (GDD §19,
 * §20). Exercises the live React shell; the §19 catalogue and the
 * mutation logic have dedicated unit coverage in
 * `src/components/options/__tests__/accessibilityPaneState.test.ts`.
 */

const SAVE_KEY = "vibegear2:save:v1";
const ASSIST_KEYS = [
  "autoAccelerate",
  "brakeAssist",
  "steeringSmoothing",
  "nitroToggleMode",
  "reducedSimultaneousInput",
  "weatherVisualReduction",
] as const;

test.describe("options accessibility pane", () => {
  test.beforeEach(async ({ page }) => {
    // Start every test from a fresh save so the default-off contract is
    // deterministic. Clearing localStorage on the origin forces the
    // defaults path through `loadSave()`.
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, SAVE_KEY);
  });

  test("renders all six §19 assist toggles unchecked by default", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-accessibility").click();

    await expect(page.getByTestId("accessibility-pane")).toBeVisible();

    for (const key of ASSIST_KEYS) {
      await expect(
        page.getByTestId(`accessibility-row-${key}`),
      ).toBeVisible();
      await expect(
        page.getByTestId(`accessibility-toggle-${key}`),
      ).not.toBeChecked();
    }
  });

  test("toggling an assist persists to localStorage and survives a reload", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-accessibility").click();

    await page.getByTestId("accessibility-toggle-autoAccelerate").check();
    await expect(
      page.getByTestId("accessibility-toggle-autoAccelerate"),
    ).toBeChecked();
    await expect(
      page.getByTestId("accessibility-row-autoAccelerate"),
    ).toHaveAttribute("data-active", "true");

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, SAVE_KEY);
    expect(persisted?.settings?.assists?.autoAccelerate).toBe(true);

    await page.reload();
    await page.getByTestId("options-tab-accessibility").click();
    await expect(
      page.getByTestId("accessibility-toggle-autoAccelerate"),
    ).toBeChecked();
  });

  test("toggling multiple assists keeps each state independent", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-accessibility").click();

    await page.getByTestId("accessibility-toggle-brakeAssist").check();
    await page.getByTestId("accessibility-toggle-steeringSmoothing").check();

    await expect(
      page.getByTestId("accessibility-toggle-brakeAssist"),
    ).toBeChecked();
    await expect(
      page.getByTestId("accessibility-toggle-steeringSmoothing"),
    ).toBeChecked();
    await expect(
      page.getByTestId("accessibility-toggle-autoAccelerate"),
    ).not.toBeChecked();

    // Toggle one back off; the other should stay on.
    await page.getByTestId("accessibility-toggle-brakeAssist").uncheck();
    await expect(
      page.getByTestId("accessibility-toggle-brakeAssist"),
    ).not.toBeChecked();
    await expect(
      page.getByTestId("accessibility-toggle-steeringSmoothing"),
    ).toBeChecked();
  });
});
