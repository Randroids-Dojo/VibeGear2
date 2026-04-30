import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROUTES = [
  { path: "/", testId: "game-title" },
  { path: "/world", testId: "world-page" },
  { path: "/garage", testId: "garage-page" },
  { path: "/options", testId: "options-page" },
  { path: "/race?mode=practice", testId: "race-canvas" },
];

test.describe("accessibility gate", () => {
  for (const route of ROUTES) {
    test(`has no critical or serious axe violations on ${route.path}`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(page.getByTestId(route.testId)).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blockingViolations = results.violations.filter((violation) =>
        ["critical", "serious"].includes(violation.impact ?? ""),
      );

      expect(blockingViolations).toEqual([]);
    });
  }
});
