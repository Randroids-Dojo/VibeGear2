import { expect, test } from "@playwright/test";

function metricNumber(text: string | null): number {
  return Number.parseFloat(text ?? "1");
}

test.describe("race audio mix telemetry", () => {
  test("countdown and live race events duck music without stopping the race", async ({
    page,
  }) => {
    await page.goto("/race?track=test/straight&mode=quickRace");

    await expect(page.getByTestId("race-phase")).toHaveText("countdown", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("race-last-audio-event")).toHaveText(
      "countdown",
      { timeout: 5_000 },
    );
    expect(
      metricNumber(await page.getByTestId("race-music-duck-scale").textContent()),
    ).toBeLessThan(1);

    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    const canvas = page.getByTestId("race-canvas-element");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.keyboard.down("Space");
    try {
      await expect
        .poll(
          async () =>
            (await page
              .getByTestId("race-observed-audio-events")
              .textContent()) ?? "none",
          { timeout: 8_000 },
        )
        .toMatch(/impact|pickupCollected|nitroEngage/u);
      expect(
        metricNumber(
          await page.getByTestId("race-music-duck-scale").textContent(),
        ),
      ).toBeLessThan(1);
    } finally {
      await page.keyboard.up("Space");
      await page.keyboard.up("ArrowUp");
    }
  });
});
