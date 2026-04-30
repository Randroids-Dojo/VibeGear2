import { expect, test } from "@playwright/test";

test.describe("daily challenge UTC clock", () => {
  test("rolls the entry route by UTC day under a browser fake clock", async ({
    page,
  }) => {
    await page.clock.setFixedTime("2026-04-30T23:59:50Z");
    await page.goto("/daily");

    await expect(page.getByTestId("daily-page")).toBeVisible();
    await expect(page.locator("#daily-title")).toHaveText("2026-04-30");
    const aprilSeed = await page.getByTestId("daily-seed").textContent();
    const aprilStartHref = await page
      .getByTestId("daily-start")
      .getAttribute("href");
    expect(aprilStartHref).toContain("daily=2026-04-30");

    await page.clock.setFixedTime("2026-05-01T00:00:05Z");
    await page.goto("/daily");

    await expect(page.locator("#daily-title")).toHaveText("2026-05-01");
    await expect(page.getByTestId("daily-seed")).not.toHaveText(
      aprilSeed ?? "",
    );
    await expect(page.getByTestId("daily-start")).toHaveAttribute(
      "href",
      /daily=2026-05-01/,
    );
  });

  test("keeps the chosen daily marker after starting across UTC midnight", async ({
    page,
  }) => {
    await page.clock.setFixedTime("2026-04-30T23:59:50Z");
    await page.goto("/daily");

    await expect(page.locator("#daily-title")).toHaveText("2026-04-30");
    await page.getByTestId("daily-start").click();
    await expect(page).toHaveURL(/daily=2026-04-30/);

    await page.clock.setFixedTime("2026-05-01T00:00:05Z");
    await expect(page).toHaveURL(/daily=2026-04-30/);
  });
});
