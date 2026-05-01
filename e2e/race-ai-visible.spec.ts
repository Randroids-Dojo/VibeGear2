import { expect, test } from "@playwright/test";

async function expectVisibleAi(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/race?track=test/straight");
  await expect(page.getByTestId("race-phase")).toHaveText("racing", {
    timeout: 8_000,
  });
  await expect
    .poll(
      async () => {
        const text = await page.getByTestId("race-visible-ai-count").textContent();
        return Number.parseInt(text ?? "0", 10);
      },
      { timeout: 25_000 },
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId("race-field-size")).not.toHaveText("1");
}

test.describe("race AI visibility", () => {
  test("renders an opponent car on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await expectVisibleAi(page);
  });

  test("renders an opponent car on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expectVisibleAi(page);
  });
});
