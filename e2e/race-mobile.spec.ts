import { expect, test, type Page } from "@playwright/test";

test.describe("mobile race playability", () => {
  test("race canvas fills the viewport without page scroll", async ({ page }) => {
    await page.goto("/race");

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);

    const scrollState = await page.evaluate(() => ({
      bodyScrollHeight: document.body.scrollHeight,
      docScrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      bodyOverflow: getComputedStyle(document.body).overflowY,
    }));
    expect(scrollState.bodyScrollHeight).toBeLessThanOrEqual(scrollState.innerHeight + 1);
    expect(scrollState.docScrollHeight).toBeLessThanOrEqual(scrollState.innerHeight + 1);
  });

  test("touch overlay drives steering and pause on the live race route", async ({ page }) => {
    await page.goto("/race");

    await expect(page.getByTestId("touch-controls")).toBeVisible();
    const surface = page.getByTestId("race-canvas-element");
    const surfaceBox = await surface.boundingBox();
    expect(surfaceBox).not.toBeNull();
    if (!surfaceBox) return;

    const startX = surfaceBox.x + surfaceBox.width * 0.18;
    const startY = surfaceBox.y + surfaceBox.height * 0.7;
    const endX = startX + Math.min(180, surfaceBox.width * 0.35);

    await pressPointer(page, startX, startY, 1);
    try {
      await movePointer(page, endX, startY, 1);
      await expect(page.getByTestId("race-touch-active")).toHaveText("yes");
      await expect.poll(async () => Number(await page.getByTestId("race-last-steer").innerText()))
        .toBeGreaterThan(0.25);
    } finally {
      await releasePointer(page, endX, startY, 1);
    }

    const pauseBox = await page.getByTestId("touch-pause").boundingBox();
    expect(pauseBox).not.toBeNull();
    if (!pauseBox) return;
    const pauseX = pauseBox.x + pauseBox.width / 2;
    const pauseY = pauseBox.y + pauseBox.height / 2;

    await pressPointer(page, pauseX, pauseY, 2);
    try {
      await expect(page.getByTestId("pause-overlay")).toBeVisible();
    } finally {
      await releasePointer(page, pauseX, pauseY, 2);
    }
  });
});

async function pressPointer(
  page: Page,
  x: number,
  y: number,
  pointerId: number,
): Promise<void> {
  await page.evaluate(
    ({ x: px, y: py, pointerId: id }) => {
      const target = document.querySelector("[data-testid='race-canvas-element']");
      if (!target) return;
      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType: "touch",
          clientX: px,
          clientY: py,
        }),
      );
    },
    { x, y, pointerId },
  );
}

async function movePointer(
  page: Page,
  toX: number,
  toY: number,
  pointerId: number,
): Promise<void> {
  await page.evaluate(
    ({ toX: bx, toY: by, pointerId: id }) => {
      const target = document.querySelector("[data-testid='race-canvas-element']");
      if (!target) return;
      target.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType: "touch",
          clientX: bx,
          clientY: by,
        }),
      );
    },
    { toX, toY, pointerId },
  );
}

async function releasePointer(
  page: Page,
  x: number,
  y: number,
  pointerId: number,
): Promise<void> {
  await page.evaluate(
    ({ x: px, y: py, pointerId: id }) => {
      const target = document.querySelector("[data-testid='race-canvas-element']");
      if (!target) return;
      target.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: id,
          pointerType: "touch",
          clientX: px,
          clientY: py,
        }),
      );
    },
    { x, y, pointerId },
  );
}
