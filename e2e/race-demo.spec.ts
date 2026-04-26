import { expect, test } from "@playwright/test";

/**
 * Phase 1 vertical-slice smoke. Visits `/race`, waits for the loading gate
 * to settle, asserts the countdown renders, drives forward for a few
 * seconds, and confirms the speed HUD updates and the lap label is
 * `1 / N`. The full `race-finished` overlay assertion is gated behind a
 * shorter run on a single-lap track via `?track=test/straight`.
 */

test.describe("phase 1 race demo", () => {
  test("boots /race, runs the countdown, and accelerates under arrow keys", async ({
    page,
  }) => {
    await page.goto("/race");

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();

    const phase = page.getByTestId("race-phase");
    // Phase reads "countdown" as soon as the loading gate settles.
    await expect(phase).toHaveText(/countdown|racing/);

    // Wait for the countdown to expire (default 3 s).
    await expect(phase).toHaveText("racing", { timeout: 10_000 });

    // Drive forward for a few seconds, then assert speed > 0.
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(2_500);
    await page.keyboard.up("ArrowUp");

    const speedText = await page.getByTestId("hud-speed").innerText();
    const speed = Number(speedText);
    expect(Number.isFinite(speed)).toBe(true);
    expect(speed).toBeGreaterThan(0);

    // Lap label should still be 1 / N for the curve track.
    const lapText = await page.getByTestId("hud-lap").innerText();
    expect(lapText).toMatch(/^1 \/ \d+$/);
  });
});
