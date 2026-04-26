import { expect, test } from "@playwright/test";

/**
 * Natural race-finish e2e per F-038. Drives a single-lap race on
 * `test/straight` with the throttle held down so the player reaches the
 * line, then asserts the route hops to `/race/results` and renders the
 * §20 results screen with the player row.
 *
 * Coordinated with sibling dot
 * `VibeGear2-implement-e2e-race-4a750bfc` (F-029): that dot owns a
 * fuller multi-lap spec; this one is the focused
 * natural-finish-wires-to-results contract for F-038. The two are
 * complementary and not redundant: F-029 stresses the multi-lap +
 * grid-of-AI surface, this spec pins the wiring boundary.
 */

test.describe("race-finish wiring (F-038)", () => {
  test(
    "natural finish on test/straight routes to /race/results with the player row",
    async ({ page }) => {
      // The single-lap straight track is 1,200 m; Sparrow GT tops out at
      // 61 m/s so a full-throttle lap completes in ~20 s of sim time
      // plus the 3 s countdown. Pad the timeout to absorb CI jitter.
      test.setTimeout(60_000);

      await page.goto("/race?track=test/straight");

      const canvas = page.getByTestId("race-canvas-element");
      await expect(canvas).toBeVisible();

      // Wait for the countdown to clear so input is sampled.
      await expect(page.getByTestId("race-phase")).toHaveText("racing", {
        timeout: 10_000,
      });

      // Drive the throttle until the route hops. The keydown listener is
      // attached to the document, so a focused canvas is not strictly
      // required, but match the existing race-demo spec for clarity.
      await canvas.focus();
      await page.keyboard.down("ArrowUp");

      // The natural-finish wiring tears down the loop and pushes the
      // router to /race/results once the player crosses the line. The
      // URL assertion is the load-bearing contract per the F-038
      // verify list.
      await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
      await page.keyboard.up("ArrowUp");

      // Results page rendered the §20 root and the player row. The row
      // identifier (`results-row-player`) matches the
      // `<FinishingOrderTable />` testid pattern asserted by the
      // results-screen spec, so a regression in the §20 surface is
      // caught in both places.
      await expect(page.getByTestId("race-results")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByTestId("race-results")).toHaveAttribute(
        "data-track",
        "test/straight",
      );
      await expect(page.getByTestId("results-row-player")).toBeVisible();
      // A natural finish carries the `finished` status (vs DNF on the
      // retire-path spec).
      await expect(page.getByTestId("results-row-player")).toHaveAttribute(
        "data-status",
        "finished",
      );
      // Continue CTA renders so the player can return to the garage.
      await expect(page.getByTestId("results-cta-continue")).toBeVisible();
    },
  );
});
