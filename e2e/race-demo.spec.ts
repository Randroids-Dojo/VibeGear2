import { expect, test, type Locator } from "@playwright/test";

async function centerRoadTopY(canvas: Locator): Promise<number> {
  return canvas.evaluate((node) => {
    const canvasEl = node as HTMLCanvasElement;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return -1;

    const x = Math.floor(canvasEl.width / 2);
    const { data } = ctx.getImageData(x, 0, 1, canvasEl.height);
    for (let y = 0; y < canvasEl.height; y += 1) {
      const offset = y * 4;
      const r = data[offset] ?? 0;
      const g = data[offset + 1] ?? 0;
      const b = data[offset + 2] ?? 0;
      const greyRoad = Math.abs(r - g) <= 8 && Math.abs(g - b) <= 8 && r >= 70 && r <= 230;
      const lanePaint = r >= 220 && g >= 220 && b >= 220;
      if (greyRoad || lanePaint) return y;
    }
    return -1;
  });
}

async function hasCanvasColourNear(
  canvas: Locator,
  target: { r: number; g: number; b: number },
  tolerance: number,
  threshold: number,
): Promise<boolean> {
  return canvas.evaluate((node, { colour, maxDelta, threshold }) => {
    const canvasEl = node as HTMLCanvasElement;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs((data[i] ?? 0) - colour.r) <= maxDelta &&
        Math.abs((data[i + 1] ?? 0) - colour.g) <= maxDelta &&
        Math.abs((data[i + 2] ?? 0) - colour.b) <= maxDelta
      ) {
        count += 1;
        if (count >= threshold) return true;
      }
    }
    return false;
  }, { colour: target, maxDelta: tolerance, threshold });
}

/**
 * Phase 1 vertical-slice smoke. Visits `/race`, waits for the loading gate
 * to settle, asserts the countdown renders, drives forward for a few
 * seconds, and confirms the speed HUD updates and the lap label is
 * `1 / N`. The full `race-finished` overlay assertion is gated behind a
 * shorter run on a single-lap track via `?track=test/straight`.
 */

test.describe("phase 1 race demo", () => {
  test("boots /race, runs the countdown, and accelerates under arrow keys", async ({
    page,
  }) => {
    await page.goto("/race");

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();

    const phase = page.getByTestId("race-phase");
    // Phase reads "countdown" as soon as the loading gate settles.
    await expect(phase).toHaveText(/countdown|racing/);

    // Wait for the countdown to expire (default 3 s).
    await expect(phase).toHaveText("racing", { timeout: 10_000 });

    // Drive forward for a few seconds, then assert speed > 0.
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(2_500);
    await page.keyboard.up("ArrowUp");

    const speedText = await page.getByTestId("hud-speed").innerText();
    const speed = Number(speedText);
    expect(Number.isFinite(speed)).toBe(true);
    expect(speed).toBeGreaterThan(0);

    // Lap label should still be 1 / N for the curve track.
    const lapText = await page.getByTestId("hud-lap").innerText();
    expect(lapText).toMatch(/^1 \/ \d+$/);
  });

  test("default race track projects authored elevation as the player advances", async ({
    page,
  }) => {
    await page.goto("/race");
    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-track",
      "test/elevation",
    );

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    const before = await centerRoadTopY(canvas);
    expect(before).toBeGreaterThan(0);

    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(6_000);
    await page.keyboard.up("ArrowUp");

    const after = await centerRoadTopY(canvas);
    expect(after).toBeGreaterThanOrEqual(0);
    expect(Math.abs(before - after)).toBeGreaterThanOrEqual(12);
  });

  test("default race track renders parallax and roadside billboard colours", async ({
    page,
  }) => {
    await page.goto("/race");
    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    const hasMountainPixels = await hasCanvasColourNear(canvas, {
      r: 37,
      g: 58,
      b: 85,
    }, 3, 8);
    const hasSignPixels = await hasCanvasColourNear(canvas, {
      r: 231,
      g: 210,
      b: 77,
    }, 3, 8);
    expect(hasMountainPixels).toBe(true);
    expect(hasSignPixels).toBe(true);
  });
});
