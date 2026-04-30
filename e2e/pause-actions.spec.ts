import { expect, test } from "@playwright/test";

/**
 * Pause-menu actions e2e per dot
 * `VibeGear2-implement-restart-retire-888c712b`.
 *
 * Drives the restart / retire / exit-to-title flows wired through
 * `usePauseActions` on the `/race` route:
 *
 *   - Restart: open the menu mid-race, click Restart, assert the
 *     phase flips back to countdown so the lap timer is at the start.
 *   - Retire: open the menu mid-race, click Retire, assert the route
 *     hops to `/race/results` with the DNF placement label.
 *   - Exit-to-Title: open the menu mid-race, click Exit, assert the
 *     route hops to `/`.
 *   - Settings: open the menu mid-race, click Settings, assert the
 *     route hops to `/options`.
 *   - Ghosts: open the menu mid-race, click Ghosts, assert the route
 *     hops to `/time-trial`.
 */

test.describe("pause actions", () => {
  test("Restart sends the race back to the countdown phase", async ({ page }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    // Drive a few hundred ms so the lap timer is non-zero before the
    // restart click. The §20 dot's verify item asks the lap timer to
    // be back at 00:00.000 after the restart; the surrogate here is
    // the phase reverting to countdown (the fresh session is created
    // with the same countdown duration as the original).
    const canvas = page.getByTestId("race-canvas-element");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowUp");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();
    await page.getByTestId("pause-restart").click();

    // The pause overlay closes and the phase returns to countdown.
    await expect(page.getByTestId("pause-overlay")).toHaveCount(0);
    await expect(page.getByTestId("race-phase")).toHaveText("countdown");
  });

  test("Retire flips to the results screen with a DNF row for the player", async ({
    page,
  }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();
    await page.getByTestId("pause-retire").click();

    // Route hops to /race/results; the page reads the
    // session-storage handoff. The player row carries
    // `data-status="dnf"` per `<FinishingOrderTable />` and renders
    // "DNF" in the position column.
    await expect(page).toHaveURL(/\/race\/results/);
    await expect(page.getByTestId("race-results")).toBeVisible({
      timeout: 10_000,
    });
    const playerRow = page.getByTestId("results-row-player");
    await expect(playerRow).toBeVisible();
    await expect(playerRow).toHaveAttribute("data-status", "dnf");
    await expect(playerRow.locator("td").first()).toHaveText("DNF");
  });

  test("Exit to title routes back to the home page", async ({ page }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();
    await page.getByTestId("pause-exit").click();

    // Route hops to the title screen.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("game-title")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("Settings routes to the options screen", async ({ page }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();
    await page.getByTestId("pause-settings").click();

    await expect(page).toHaveURL(/\/options$/);
    await expect(page.getByTestId("options-page")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("Ghosts routes to the Time Trial ghost surface", async ({ page }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();
    await page.getByTestId("pause-ghosts").click();

    await expect(page).toHaveURL(/\/time-trial$/);
    await expect(page.getByTestId("time-trial-page")).toBeVisible({
      timeout: 5_000,
    });
  });
});
