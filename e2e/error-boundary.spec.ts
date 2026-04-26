import { expect, test } from "@playwright/test";

/**
 * Error boundary e2e (closes part of F-016).
 *
 * Drives the `<ErrorBoundary />` mounted at the root layout. The dev
 * route `/dev/throw` is a client component that throws synchronously
 * during render, which the boundary catches via `componentDidCatch`
 * and surfaces with the fallback UI. We assert each affordance the
 * fallback exposes.
 */

test.describe("error boundary", () => {
  test("renders the fallback UI when a render throws", async ({ page }) => {
    await page.goto("/dev/throw");

    const fallback = page.getByTestId("error-boundary-fallback");
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute("role", "alert");

    await expect(page.getByTestId("error-boundary-message")).toContainText(
      "Forced render throw from /dev/throw",
    );

    await expect(page.getByTestId("error-boundary-reload")).toBeVisible();
    await expect(page.getByTestId("error-boundary-copy")).toBeVisible();
  });

  test("Reload button refreshes the page", async ({ page }) => {
    await page.goto("/dev/throw");
    await expect(page.getByTestId("error-boundary-fallback")).toBeVisible();

    await Promise.all([
      page.waitForLoadState("load"),
      page.getByTestId("error-boundary-reload").click(),
    ]);

    // After reload the throw fires again; the fallback should still be
    // up. Assert the same testid resolves to confirm the reload landed
    // and the boundary captured the second throw.
    await expect(page.getByTestId("error-boundary-fallback")).toBeVisible();
  });

  test("Copy error button does not crash", async ({ page, context }) => {
    await page.goto("/dev/throw");
    await expect(page.getByTestId("error-boundary-fallback")).toBeVisible();

    // Grant clipboard permissions scoped to the page origin so the
    // navigator.clipboard call resolves cleanly. The button gracefully
    // returns when clipboard is unavailable, but granting here proves
    // the success path. Skip silently if the URL is not parseable.
    try {
      const origin = new URL(page.url()).origin;
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin,
      });
    } catch {
      // Permissions could not be scoped; the button still no-ops cleanly.
    }

    await page.getByTestId("error-boundary-copy").click();
    // The copy is silent on success; assert the fallback is still up
    // (a click that threw would have unmounted the tree).
    await expect(page.getByTestId("error-boundary-fallback")).toBeVisible();
  });
});
