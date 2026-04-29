import { expect, test } from "@playwright/test";

/**
 * Playwright smoke for the deploy-update banner.
 *
 * Intercepts `/api/version` to return a SHA the client bundle never
 * had, then waits past the banner's 30s initial delay and asserts it
 * appears with a clickable RELOAD button. The full unit + branch
 * coverage lives in
 * `src/components/update/__tests__/checkRemoteVersion.test.ts`; this
 * spec only proves the wiring (route handler reachable, client polls
 * it, banner renders into the production layout) holds together
 * inside a real browser.
 *
 * The 30s initial delay is by design (avoids hammering the API on
 * page load), so the per-test timeout is bumped above the default.
 */

test.describe("update banner", () => {
  test("appears when the server reports a newer build", async ({ page }) => {
    test.setTimeout(60_000);

    await page.route("**/api/version", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ version: "totally-different-sha" }),
      });
    });

    await page.goto("/");

    const banner = page.getByTestId("update-banner");
    await expect(banner).toBeVisible({ timeout: 45_000 });
    await expect(banner).toContainText("NEW VERSION AVAILABLE");

    const reload = page.getByTestId("update-banner-reload");
    await expect(reload).toBeVisible();
    await expect(reload).toBeEnabled();
    await expect(reload).toHaveText("RELOAD");
  });
});
