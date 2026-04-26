import { expect, test } from "@playwright/test";

/**
 * Difficulty preset selection in /options Difficulty pane (GDD §15, §20).
 * Exercises the live React shell; the §15 preset table and the
 * mutation logic have dedicated unit coverage in
 * `src/components/options/__tests__/difficultyPaneState.test.ts`.
 */

const SAVE_KEY = "vibegear2:save:v1";

test.describe("options difficulty pane", () => {
  test.beforeEach(async ({ page }) => {
    // Start every test from a fresh save so the default-Normal contract
    // and the Master-locked state are deterministic. The page sets the
    // key after first interaction; clearing localStorage on the origin
    // forces the defaults path through `loadSave()`.
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, SAVE_KEY);
  });

  test("renders all four §15 preset tiles with Normal selected by default", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-difficulty").click();

    await expect(page.getByTestId("difficulty-pane")).toBeVisible();

    for (const id of ["easy", "normal", "hard", "master"]) {
      await expect(page.getByTestId(`difficulty-preset-${id}`)).toBeVisible();
    }

    await expect(
      page.getByTestId("difficulty-preset-normal-input"),
    ).toBeChecked();

    await expect(page.getByTestId("difficulty-detail")).toHaveAttribute(
      "data-active-preset",
      "normal",
    );
    await expect(page.getByTestId("difficulty-detail-ai-pace")).toHaveText(
      "Baseline",
    );
  });

  test("Master tile is locked on a fresh save and cannot be selected", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-difficulty").click();

    const masterInput = page.getByTestId("difficulty-preset-master-input");
    await expect(masterInput).toBeDisabled();
    await expect(
      page.getByTestId("difficulty-preset-master"),
    ).toHaveAttribute("data-locked", "true");
    await expect(
      page.getByTestId("difficulty-preset-master-locked"),
    ).toBeVisible();

    // Tooltip surfaces the §15 unlock condition wording.
    await expect(
      page.getByTestId("difficulty-preset-master"),
    ).toHaveAttribute("title", /championship.*Hard/i);
  });

  test("selecting Hard updates the detail panel and persists to localStorage", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-difficulty").click();

    await page.getByTestId("difficulty-preset-hard-input").check();

    await expect(
      page.getByTestId("difficulty-preset-hard-input"),
    ).toBeChecked();
    await expect(page.getByTestId("difficulty-detail")).toHaveAttribute(
      "data-active-preset",
      "hard",
    );
    await expect(page.getByTestId("difficulty-detail-ai-pace")).toHaveText(
      "+5%",
    );
    await expect(
      page.getByTestId("difficulty-detail-rubber-banding"),
    ).toHaveText("Minimal");

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, SAVE_KEY);
    expect(persisted?.settings?.difficultyPreset).toBe("hard");

    // Reload and confirm the radio reflects the persisted preset.
    await page.reload();
    await page.getByTestId("options-tab-difficulty").click();
    await expect(
      page.getByTestId("difficulty-preset-hard-input"),
    ).toBeChecked();
  });

  test("renders the mid-tour caveat note", async ({ page }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-difficulty").click();

    await expect(
      page.getByTestId("difficulty-mid-tour-note"),
    ).toContainText(/championship/i);
  });
});
