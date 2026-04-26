import { expect, test } from "@playwright/test";

/**
 * Pause overlay e2e (closes part of F-016).
 *
 * Drives the `<PauseOverlay />` mounted at `/race`. The same hook that
 * flips the overlay open also calls `LoopHandle.pause()` on the
 * underlying fixed-step loop, so the speedometer value should not
 * advance while the menu is open.
 *
 * The Retire-race button is wired through `<PauseOverlay />` props but
 * the race route does not yet supply an `onRetire` callback (the
 * results screen lives in a later slice). We assert the button is
 * present and disabled in that case so the spec catches a regression
 * when retirement lands later without needing a churn-only update.
 */

test.describe("pause overlay", () => {
  test("Escape opens the overlay and pauses the simulation", async ({ page }) => {
    await page.goto("/race");

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();

    // Wait for the countdown to expire so the loop is in `racing` and
    // the speedometer has something to read.
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    // Drive forward briefly so the speedometer reads a non-zero value.
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(750);
    await page.keyboard.up("ArrowUp");

    const speedBefore = Number(await page.getByTestId("hud-speed").innerText());
    expect(Number.isFinite(speedBefore)).toBe(true);
    expect(speedBefore).toBeGreaterThan(0);

    // Open the pause overlay.
    await page.keyboard.press("Escape");
    const overlay = page.getByTestId("pause-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("pause-resume")).toBeFocused();

    // Speed is rendered from the latest sim sample. While paused the
    // sim does not advance, so the value is stable across a render
    // tick. Sample twice with a 500 ms gap to confirm no drift.
    const sample1 = Number(await page.getByTestId("hud-speed").innerText());
    await page.waitForTimeout(500);
    const sample2 = Number(await page.getByTestId("hud-speed").innerText());
    expect(sample1).toBe(sample2);
  });

  test("Escape again resumes the race", async ({ page }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toHaveCount(0);
  });

  test("Resume button dismisses the overlay", async ({ page }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();

    await page.getByTestId("pause-resume").click();
    await expect(page.getByTestId("pause-overlay")).toHaveCount(0);
  });

  test("Retire entry is present (disabled until the results route lands)", async ({
    page,
  }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-overlay")).toBeVisible();

    const retire = page.getByTestId("pause-retire");
    await expect(retire).toBeVisible();
    // The race route does not pass an `onRetire` handler yet, so the
    // button is disabled per `<PauseOverlay />`'s contract. When the
    // results screen lands the parent will pass the handler and this
    // assertion will flip to `toBeEnabled`.
    await expect(retire).toBeDisabled();
  });
});
