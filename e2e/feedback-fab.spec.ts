import { expect, test } from "@playwright/test";

/**
 * F-077. Playwright coverage for the global Feedback FAB. The FAB
 * mounts in `app/layout.tsx`, so any route renders it. We drive
 * the open / type / submit / dismiss flow against a stubbed
 * `/api/feedback` route so the test does not depend on GitHub
 * connectivity or the rate-limit token.
 */

test.describe("feedback FAB", () => {
  test.beforeEach(async ({ page }) => {
    // Stub the feedback API so the test never reaches GitHub. Reply
    // with a minimal 200 payload mirroring the production shape.
    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, issueUrl: "https://example.invalid/1" }),
      });
    });
  });

  test("opens the panel, submits a message, and shows the success state", async ({
    page,
  }) => {
    await page.goto("/");

    const toggle = page.getByTestId("feedback-fab-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();

    const panel = page.getByTestId("feedback-fab-panel");
    await expect(panel).toBeVisible();

    const textarea = page.getByTestId("feedback-fab-textarea");
    const submit = page.getByTestId("feedback-fab-submit");

    // Submit is disabled until the textarea has at least one
    // non-whitespace character; an empty form must not POST.
    await expect(submit).toBeDisabled();
    await textarea.fill("Brake-flash readability is great in the rain.");
    await expect(submit).toBeEnabled();

    const requestPromise = page.waitForRequest("**/api/feedback");
    await submit.click();
    const request = await requestPromise;
    expect(request.method()).toBe("POST");
    const body = JSON.parse(request.postData() ?? "{}") as Record<
      string,
      unknown
    >;
    expect(typeof body.title).toBe("string");
    expect(body.body).toBe("Brake-flash readability is great in the rain.");

    // Success block replaces the form once the stubbed 200 lands.
    await expect(page.getByTestId("feedback-fab-success")).toBeVisible();
  });

  test("Escape closes the panel without submitting", async ({ page }) => {
    let postCount = 0;
    await page.route("**/api/feedback", async (route) => {
      postCount += 1;
      await route.fulfill({ status: 200, body: "{}" });
    });

    await page.goto("/");
    await page.getByTestId("feedback-fab-toggle").click();
    await expect(page.getByTestId("feedback-fab-panel")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("feedback-fab-panel")).toHaveCount(0);
    expect(postCount).toBe(0);
  });

  test("click outside the panel dismisses it", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("feedback-fab-toggle").click();
    await expect(page.getByTestId("feedback-fab-panel")).toBeVisible();

    // Click the page header / title - safely outside the panel and
    // the toggle button. The Title page renders a `game-title`
    // testid that sits at the top of the layout.
    await page.getByTestId("game-title").click();
    await expect(page.getByTestId("feedback-fab-panel")).toHaveCount(0);
  });
});
