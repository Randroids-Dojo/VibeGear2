import { expect, test } from "@playwright/test";

test.describe("browser text selection", () => {
  test("disables selection on game UI while preserving editable controls", async ({
    page,
  }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-canvas")).toBeVisible();

    const raceSelectionStyles = await page.evaluate(() => ({
      body: getComputedStyle(document.body).userSelect,
      shell: getComputedStyle(
        document.querySelector('[data-testid="race-canvas"]')!,
      ).userSelect,
      canvas: getComputedStyle(
        document.querySelector('[data-testid="race-canvas-element"]')!,
      ).userSelect,
    }));

    expect(raceSelectionStyles).toEqual({
      body: "none",
      shell: "none",
      canvas: "none",
    });

    await page.goto("/daily");
    const textareaSelection = await page
      .getByTestId("daily-share-text")
      .evaluate((node) => getComputedStyle(node).userSelect);

    expect(textareaSelection).toBe("text");

    const editableSelection = await page.evaluate(() => {
      const editable = document.createElement("div");
      editable.setAttribute("contenteditable", "plaintext-only");
      editable.textContent = "Editable note";
      document.body.append(editable);
      const userSelect = getComputedStyle(editable).userSelect;
      editable.remove();
      return userSelect;
    });

    expect(editableSelection).toBe("text");
  });
});
