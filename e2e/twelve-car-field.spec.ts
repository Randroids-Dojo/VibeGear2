import { expect, test } from "@playwright/test";

test("World Tour race starts with a 12-car field on a 12-slot track", async ({
  page,
}) => {
  await page.goto("/race?tour=velvet-coast&raceIndex=0");
  await expect(page.getByTestId("race-phase")).toHaveText(/countdown|racing/, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("race-field-size")).toHaveText("12");
});
