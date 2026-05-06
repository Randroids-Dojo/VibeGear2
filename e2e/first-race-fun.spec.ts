import { expect, test } from "@playwright/test";

function metricNumber(text: string | null): number {
  return Number.parseInt(text ?? "0", 10);
}

test.describe("first quick race fun pass", () => {
  test("default quick race shows the core loop inside one race", async ({
    page,
  }) => {
    // Velvet Coast Harbor Run is now a 3-lap race (standard archetype).
    // The full ArrowUp-to-finish-line run plus boot, countdown, and
    // results routing comfortably fits in 5 minutes.
    test.setTimeout(300_000);

    await page.goto("/quick-race");
    await expect(page.getByTestId("quick-race-page")).toBeVisible();
    await expect(page.getByTestId("quick-race-track")).toHaveValue(
      "velvet-coast/harbor-run",
    );

    await page.getByTestId("quick-race-start").click();

    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-track",
      "velvet-coast/harbor-run",
    );
    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-mode",
      "quickRace",
    );
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await expect
      .poll(
        async () =>
          metricNumber(
            await page.getByTestId("race-visible-ai-count").textContent(),
          ),
        { timeout: 25_000 },
      )
      .toBeGreaterThan(0);
    const canvas = page.getByTestId("race-canvas-element");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.keyboard.down("Space");
    await expect(page.getByTestId("race-player-nitro-active")).toHaveText(
      "yes",
      { timeout: 5_000 },
    );
    await page.keyboard.up("Space");

    await expect
      .poll(
        async () =>
          metricNumber(
            await page.getByTestId("race-visible-pickup-count").textContent(),
          ),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    await expect(page.getByTestId("race-last-pickup-kind")).toHaveText("nitro", {
      timeout: 35_000,
    });

    await expect
      .poll(
        async () =>
          metricNumber(
            await page.getByTestId("race-collected-pickup-count").textContent(),
          ),
        { timeout: 40_000 },
      )
      .toBeGreaterThanOrEqual(2);

    // 3-lap Velvet Coast race takes 150-240 s on production tracks; the
    // pre-fix single-lap pacing bug only needed ~90 s.
    await expect(page).toHaveURL(/\/race\/results/, { timeout: 240_000 });
    await page.keyboard.up("ArrowUp");

    await expect(page.getByTestId("race-results")).toBeVisible();
    await expect(page.getByTestId("results-credits-awarded")).toHaveText("0 cr");
    await expect(page.getByTestId("results-cta-continue")).toBeVisible();

    await page.getByTestId("results-cta-continue").click();
    await expect(page).toHaveURL(/\/garage$/);
    await expect(page.getByTestId("garage-page")).toBeVisible();
  });
});
