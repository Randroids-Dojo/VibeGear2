import { expect, test } from "@playwright/test";

/**
 * Loading screen e2e (closes F-018).
 *
 * Drives the `<LoadingGate />` against the dev page at `/dev/loading`.
 * The dev page reads `?delay=<ms>` and feeds it to its synthetic
 * fetcher so each entry resolves after the configured delay; the spec
 * uses a generous delay so the loading bar is observable across at
 * least one progress event before the gate exits.
 */

const SLOW_DELAY_MS = 300;

test.describe("loading screen", () => {
  test("renders progress and resolves to the ready card", async ({ page }) => {
    await page.goto(`/dev/loading?delay=${SLOW_DELAY_MS}`);

    const screen = page.getByTestId("loading-screen");
    await expect(screen).toBeVisible();
    await expect(screen).toHaveAttribute("data-phase", "loading");

    // The text reads "Loading <completed> of <total>" while in flight.
    const text = page.getByTestId("loading-screen-text");
    await expect(text).toContainText(/Loading \d+ of 4/);

    // Once every entry settles the gate unmounts the screen and renders
    // the children with the decoded asset map. Wait for the dev shell's
    // ready card so we know the gate exited cleanly.
    await expect(page.getByTestId("loading-dev-ready")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("loading-dev-ready")).toContainText(
      "4 assets loaded",
    );
    await expect(page.getByTestId("loading-screen")).toHaveCount(0);
  });

  test("critical failure surfaces the retry button", async ({ page }) => {
    await page.goto(`/dev/loading?delay=80&fail=1`);

    const screen = page.getByTestId("loading-screen");
    await expect(screen).toBeVisible();

    // The forced-failure entry settles quickly because the dev fetcher
    // delays every entry uniformly. Wait for the phase to flip and the
    // retry button to mount.
    await expect(screen).toHaveAttribute("data-phase", "failed-critical", {
      timeout: 10_000,
    });

    const retry = page.getByTestId("loading-screen-retry");
    await expect(retry).toBeVisible();
  });
});
