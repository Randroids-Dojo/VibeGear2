import { expect, test } from "@playwright/test";

const FIRST_TOUR_TRACKS = [
  "velvet-coast/harbor-run",
  "velvet-coast/sunpier-loop",
  "velvet-coast/cliffline-arc",
  "velvet-coast/lighthouse-fall",
];

function metricNumber(text: string | null): number {
  return Number.parseInt(text ?? "0", 10);
}

test.describe("first-tour authored event pass", () => {
  for (const trackId of FIRST_TOUR_TRACKS) {
    test(`${trackId} boots and exposes an authored pickup`, async ({ page }) => {
      await page.goto(`/race?track=${encodeURIComponent(trackId)}&mode=practice`);

      await expect(page.getByTestId("race-canvas")).toHaveAttribute(
        "data-track",
        trackId,
      );
      await expect(page.getByTestId("race-phase")).toHaveText("racing", {
        timeout: 10_000,
      });

      const canvas = page.getByTestId("race-canvas-element");
      await expect(canvas).toBeVisible();
      await canvas.focus();
      await page.keyboard.down("ArrowUp");
      try {
        await expect
          .poll(
            async () =>
              metricNumber(
                await page
                  .getByTestId("race-visible-pickup-count")
                  .textContent(),
              ),
            { timeout: 20_000 },
          )
          .toBeGreaterThan(0);
      } finally {
        await page.keyboard.up("ArrowUp");
      }
    });
  }
});
