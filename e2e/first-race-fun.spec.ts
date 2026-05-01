import { expect, test } from "@playwright/test";

function metricNumber(text: string | null): number {
  return Number.parseInt(text ?? "0", 10);
}

test.describe("first quick race fun pass", () => {
  test("default quick race shows the core loop inside one race", async ({
    page,
  }) => {
    test.setTimeout(120_000);

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

    await expect(page.getByTestId("race-last-pickup-kind")).toHaveText("cash", {
      timeout: 20_000,
    });

    await expect(page.getByTestId("race-last-pickup-kind")).toHaveText("nitro", {
      timeout: 35_000,
    });

    await expect
      .poll(
        async () =>
          metricNumber(
            await page.getByTestId("race-collected-pickup-count").textContent(),
          ),
      )
      .toBeGreaterThanOrEqual(2);

    await expect(page).toHaveURL(/\/race\/results/, { timeout: 90_000 });
    await page.keyboard.up("ArrowUp");

    await expect(page.getByTestId("race-results")).toBeVisible();
    await expect(page.getByTestId("results-credits-awarded")).toHaveText("0 cr");
    await expect(page.getByTestId("results-cta-continue")).toBeVisible();

    await page.getByTestId("results-cta-continue").click();
    await expect(page).toHaveURL(/\/garage$/);
    await expect(page.getByTestId("garage-page")).toBeVisible();
  });
});
