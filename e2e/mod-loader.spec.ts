import { expect, test } from "@playwright/test";

test("loads the starter sample mod through the browser loader", async ({ page }) => {
  await page.goto("/dev/mods");

  await expect(page.getByTestId("mod-loader-page")).toBeVisible();
  await expect(page.getByTestId("mod-loader-status")).toHaveText("ready");
  await expect(page.getByTestId("mod-id")).toHaveText("starter-sample");
  await expect(page.getByTestId("mod-track-count")).toHaveText("1");
  await expect(page.getByTestId("mod-track-id")).toHaveText(
    "starter-sample/sample-loop",
  );
});
