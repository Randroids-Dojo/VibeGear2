import { expect, test } from "@playwright/test";

function metricNumber(text: string | null): number {
  return Number.parseInt(text ?? "0", 10);
}

test.describe("race pickups", () => {
  test("renders pickups, collects one, and reports feedback", async ({ page }) => {
    await page.goto("/race?track=test/straight");

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    const visiblePickups = page.getByTestId("race-visible-pickup-count");
    await expect
      .poll(
        async () => metricNumber(await visiblePickups.textContent()),
        { timeout: 5_000 },
      )
      .toBeGreaterThan(0);

    const initialVisible = metricNumber(await visiblePickups.textContent());
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect
      .poll(
        async () =>
          metricNumber(
            await page.getByTestId("race-collected-pickup-count").textContent(),
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
    await page.keyboard.up("ArrowUp");

    await expect(page.getByTestId("race-last-pickup-kind")).toHaveText("cash", {
      timeout: 20_000,
    });
    await expect
      .poll(async () => metricNumber(await visiblePickups.textContent()))
      .toBeLessThan(initialVisible);
  });
});
