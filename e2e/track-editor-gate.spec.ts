import { expect, test } from "@playwright/test";

test("track editor is not reachable in production builds", async ({ page }) => {
  const response = await page.goto("/dev/track-editor");
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("track-editor-page")).toHaveCount(0);
});
