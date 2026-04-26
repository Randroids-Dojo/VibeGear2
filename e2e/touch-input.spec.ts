import { expect, test } from "@playwright/test";

/**
 * Touch input e2e (closes F-017).
 *
 * Runs against the mobile-chromium project (iPhone 13 emulation), which
 * reports `pointer:coarse` and has touch enabled. The dev page at
 * `/dev/touch` mounts `<TouchControls forceVisible />` over a surface
 * div that owns the underlying `createInputManager({ touchTarget })`
 * subscription.
 *
 * The spec drives pointer events directly via `page.touchscreen.tap`
 * and `page.touchscreen.tap` chained moves so the touch source sees a
 * realistic pointerdown / pointermove / pointerup sequence.
 */

test.describe("touch input", () => {
  test("holding the accelerator zone drives throttle to 1", async ({ page }) => {
    await page.goto("/dev/touch");

    const surface = page.getByTestId("touch-surface");
    await expect(surface).toBeVisible();

    // Resolve the accelerator centre from the rendered overlay so the
    // assertion stays in sync with the layout constants. The GAS group
    // is an `<g>` element; its bounding box is the centre of the
    // circle.
    const accel = page.getByTestId("touch-accelerate");
    const accelBox = await accel.boundingBox();
    expect(accelBox).not.toBeNull();
    if (!accelBox) return;

    const cx = accelBox.x + accelBox.width / 2;
    const cy = accelBox.y + accelBox.height / 2;

    // Press without releasing so the dev page's render loop reads a
    // non-zero throttle on the next sample. The dev page throttles UI
    // pushes to ~30 Hz so we wait briefly before reading the metric.
    await pressPointer(page, cx, cy);
    try {
      await page.waitForTimeout(120);
      const throttleText = await page
        .getByTestId("touch-metric-throttle")
        .innerText();
      expect(Number(throttleText)).toBeGreaterThan(0);
    } finally {
      await releasePointer(page, cx, cy);
    }
  });

  test("holding the brake zone drives brake to 1", async ({ page }) => {
    await page.goto("/dev/touch");

    const brake = page.getByTestId("touch-brake");
    const brakeBox = await brake.boundingBox();
    expect(brakeBox).not.toBeNull();
    if (!brakeBox) return;

    const cx = brakeBox.x + brakeBox.width / 2;
    const cy = brakeBox.y + brakeBox.height / 2;
    await pressPointer(page, cx, cy);
    try {
      await page.waitForTimeout(120);
      const brakeText = await page.getByTestId("touch-metric-brake").innerText();
      expect(Number(brakeText)).toBeGreaterThan(0);
    } finally {
      await releasePointer(page, cx, cy);
    }
  });

  test("dragging the steering stick to the right reads positive steer", async ({
    page,
  }) => {
    await page.goto("/dev/touch");

    const surface = page.getByTestId("touch-surface");
    const surfaceBox = await surface.boundingBox();
    expect(surfaceBox).not.toBeNull();
    if (!surfaceBox) return;

    // Anchor the stick well inside the left zone (the layout default
    // splits at width / 2). Use the surface's on-page coordinates so
    // we are independent of the page scroll position. The drag
    // distance is computed against the surface width so it scales
    // with the mobile viewport (which renders the 800-wide surface
    // at the device's CSS pixel width).
    const startX = surfaceBox.x + surfaceBox.width * 0.18;
    const startY = surfaceBox.y + surfaceBox.height * 0.7;
    const endX = startX + Math.min(200, surfaceBox.width * 0.45);
    const endY = startY;

    await pressPointer(page, startX, startY);
    try {
      await movePointer(page, startX, startY, endX, endY);
      await page.waitForTimeout(120);
      const steerText = await page.getByTestId("touch-metric-steer").innerText();
      const steer = Number(steerText);
      expect(steer).toBeGreaterThan(0.3);
    } finally {
      await releasePointer(page, endX, endY);
    }
  });

  test("holding the pause corner sets the pause input flag", async ({ page }) => {
    await page.goto("/dev/touch");

    const pauseBox = await page.getByTestId("touch-pause").boundingBox();
    expect(pauseBox).not.toBeNull();
    if (!pauseBox) return;

    const cx = pauseBox.x + pauseBox.width / 2;
    const cy = pauseBox.y + pauseBox.height / 2;
    await pressPointer(page, cx, cy);
    try {
      await page.waitForTimeout(120);
      await expect(page.getByTestId("touch-metric-pause")).toHaveText("1");
    } finally {
      await releasePointer(page, cx, cy);
    }
  });
});

/**
 * Press a pointer down at the given page-space coordinates without
 * releasing it. The caller is responsible for calling
 * `releasePointer` afterwards (typically inside a try / finally so a
 * failing assertion does not leak a stuck pointer into the next
 * test). Uses `page.evaluate` to dispatch `PointerEvent`s directly
 * because Playwright's touchscreen helper does not expose a press /
 * release primitive distinct from `tap`.
 */
async function pressPointer(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
): Promise<void> {
  await page.evaluate(
    ({ x: px, y: py }) => {
      const target = document.elementFromPoint(px, py);
      if (!target) return;
      target.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: px,
          clientY: py,
        }),
      );
    },
    { x, y },
  );
}

async function movePointer(
  page: import("@playwright/test").Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Promise<void> {
  await page.evaluate(
    ({ fromX: ax, fromY: ay, toX: bx, toY: by }) => {
      const target = document.elementFromPoint(ax, ay) ?? document.elementFromPoint(bx, by);
      if (!target) return;
      target.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: bx,
          clientY: by,
        }),
      );
    },
    { fromX, fromY, toX, toY },
  );
}

async function releasePointer(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
): Promise<void> {
  await page.evaluate(
    ({ x: px, y: py }) => {
      const target = document.elementFromPoint(px, py);
      if (!target) return;
      target.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          clientX: px,
          clientY: py,
        }),
      );
    },
    { x, y },
  );
}
