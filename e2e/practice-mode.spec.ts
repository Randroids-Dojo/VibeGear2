import { expect, test } from "@playwright/test";

test.describe("practice mode", () => {
  test("starts without stakes and swaps weather in-session", async ({ page }) => {
    await page.goto(
      "/race?mode=practice&track=velvet-coast%2Fharbor-run&weather=clear",
    );

    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-mode",
      "practice",
    );
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("race-field-size")).toHaveText("1");
    await expect(page.getByTestId("practice-panel")).toBeVisible();
    await expect(page.getByTestId("practice-weather-select")).toHaveValue(
      "clear",
    );
    await expect(page.getByTestId("practice-grip")).toHaveText(/^\d+%$/);
    const clearGripText = await page.getByTestId("practice-grip").textContent();
    const clearGrip = Number(clearGripText?.replace("%", ""));
    expect(clearGrip).toBeGreaterThan(0);
    await expect(page.getByTestId("practice-checkpoint-reset")).toBeDisabled();

    await page.getByTestId("practice-weather-select").selectOption("rain");

    await expect(page.getByTestId("practice-weather-select")).toHaveValue(
      "rain",
    );
    await expect
      .poll(async () =>
        Number(
          (await page.getByTestId("practice-grip").textContent())?.replace(
            "%",
            "",
          ),
        ),
      )
      .toBeLessThan(clearGrip);

    await page.getByTestId("practice-restart").click();
    await expect(page.getByTestId("race-phase")).toHaveText("racing");
  });
});
