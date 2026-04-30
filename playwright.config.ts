import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CROSS_BROWSER = process.env.PLAYWRIGHT_CROSS_BROWSER === "1";
const COMPATIBILITY_SMOKE = /cross-browser-smoke\.spec\.ts/;

/**
 * Playwright configuration for VibeGear2.
 *
 * Boots a production Next.js build on a non-default port so local dev
 * sessions on 3000 do not collide with CI runs. Reuses the running server
 * locally for fast iteration.
 *
 * See docs/gdd/21-technical-design-for-web-implementation.md "Testing
 * approach" for the broader e2e strategy.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: CROSS_BROWSER
    ? [
        {
          name: "cross-browser-chromium",
          use: { ...devices["Desktop Chrome"] },
          testMatch: COMPATIBILITY_SMOKE,
        },
        {
          name: "cross-browser-firefox",
          use: { ...devices["Desktop Firefox"] },
          testMatch: COMPATIBILITY_SMOKE,
        },
        {
          name: "cross-browser-webkit",
          use: { ...devices["Desktop Safari"] },
          testMatch: COMPATIBILITY_SMOKE,
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          // The mobile-chromium project owns the touch-input spec; exclude
          // it from desktop runs so a desktop pointer profile does not try
          // to drive the on-screen overlay.
          testIgnore: /(touch-input|race-mobile|cross-browser-smoke)\.spec\.ts/,
        },
        {
          // Mobile profile for the touch-input spec (closes F-017). Reports
          // `pointer:coarse`, has touch enabled, and emulates the iPhone 13
          // viewport so the overlay layout matches what users see on
          // device. Keep browserName on Chromium because CI installs only
          // Chromium browsers for the e2e job.
          name: "mobile-chromium",
          use: { ...devices["iPhone 13"], browserName: "chromium" },
          testMatch: /(touch-input|race-mobile)\.spec\.ts/,
        },
      ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT} --hostname 127.0.0.1`,
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
