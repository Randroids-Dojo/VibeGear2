import { expect, test } from "@playwright/test";

test.describe("race story HUD moments", () => {
  test("announces a position change in the live race overlay", async ({
    page,
  }) => {
    test.setTimeout(45_000);

    await page.goto("/race?track=test/straight");

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("race-field-size")).not.toHaveText("1");

    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    const moment = page.getByTestId("race-moment");
    await expect(moment).toHaveAttribute(
      "data-kind",
      /clean-pass|lost-position/,
      {
        timeout: 25_000,
      },
    );
    const momentKind = await moment.getAttribute("data-kind");
    expect(momentKind).toMatch(/clean-pass|lost-position/);
    await expect(moment).toContainText(
      momentKind === "clean-pass" ? "Pass" : "Position lost",
    );
    await expect(page.getByTestId("race-story-moment-kind")).toHaveText(
      momentKind ?? "",
    );
    await page.keyboard.up("ArrowUp");
  });
});
