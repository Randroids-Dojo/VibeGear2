import { expect, test, type Page } from "@playwright/test";

interface ProjectionSample {
  readonly speed: number;
  readonly aiDepth: number | null;
  readonly aiX: number | null;
  readonly aiWidth: number | null;
  readonly aiWidthDepth: number | null;
  readonly roadVisibleStrips: number;
  readonly roadNearCenterX: number | null;
  readonly roadNearY: number | null;
  readonly roadNearHalfWidth: number | null;
  readonly roadHorizonY: number | null;
}

async function numberText(page: Page, testId: string): Promise<number | null> {
  const text = (await page.getByTestId(testId).textContent({ timeout: 1_000 }))?.trim();
  if (!text || text === "none") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

async function sampleProjection(page: Page): Promise<ProjectionSample> {
  return {
    speed: (await numberText(page, "hud-speed")) ?? 0,
    aiDepth: await numberText(page, "race-ai-nearest-depth"),
    aiX: await numberText(page, "race-ai-nearest-x"),
    aiWidth: await numberText(page, "race-ai-nearest-width"),
    aiWidthDepth: await numberText(page, "race-ai-width-depth-product"),
    roadVisibleStrips: (await numberText(page, "race-road-visible-strips")) ?? 0,
    roadNearCenterX: await numberText(page, "race-road-near-center-x"),
    roadNearY: await numberText(page, "race-road-near-y"),
    roadNearHalfWidth: await numberText(page, "race-road-near-half-width"),
    roadHorizonY: await numberText(page, "race-road-horizon-y"),
  };
}

function adjacentMaxRatio(values: readonly number[]): number {
  let maxRatio = 1;
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const next = values[i];
    if (!prev || !next || prev <= 0 || next <= 0) continue;
    maxRatio = Math.max(maxRatio, Math.max(prev, next) / Math.min(prev, next));
  }
  return maxRatio;
}

test.describe("projection readability", () => {
  test("keeps hill road projection and opponent scale stable", async ({ page }) => {
    test.setTimeout(60_000);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/race?track=test/elevation&car=sparrow-gt");

    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-track",
      "test/elevation",
    );
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    const canvas = page.getByTestId("race-canvas-element");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");

    const samples: ProjectionSample[] = [];
    for (let i = 0; i < 36; i += 1) {
      await page.waitForTimeout(250);
      samples.push(await sampleProjection(page));
    }
    await page.keyboard.up("ArrowUp");

    const movingSamples = samples.filter((sample) => sample.speed >= 20);
    expect(movingSamples.length).toBeGreaterThanOrEqual(14);

    const roadSamples = movingSamples.filter(
      (sample) =>
        sample.roadNearCenterX !== null &&
        sample.roadNearY !== null &&
        sample.roadNearHalfWidth !== null &&
        sample.roadHorizonY !== null,
    );
    expect(roadSamples.length).toBeGreaterThanOrEqual(14);
    expect(Math.min(...roadSamples.map((sample) => sample.roadVisibleStrips))).toBeGreaterThan(1);
    expect(
      roadSamples.every(
        (sample) =>
          Number.isFinite(sample.roadNearCenterX) &&
          Number.isFinite(sample.roadNearY) &&
          Number.isFinite(sample.roadNearHalfWidth) &&
          Number.isFinite(sample.roadHorizonY),
      ),
    ).toBe(true);
    expect(
      roadSamples.some(
        (sample) => sample.roadVisibleStrips <= 5 && sample.aiDepth === null,
      ),
    ).toBe(true);

    const aiSamples = movingSamples.filter(
      (sample) =>
        sample.aiDepth !== null &&
        sample.aiX !== null &&
        sample.aiWidth !== null &&
        sample.aiWidthDepth !== null &&
        sample.aiWidth! >= 20 &&
        sample.aiWidth! < 90,
    );
    expect(aiSamples.length).toBeGreaterThanOrEqual(6);
    expect(adjacentMaxRatio(aiSamples.map((sample) => sample.aiWidthDepth!))).toBeLessThan(1.7);
    for (let i = 1; i < aiSamples.length; i += 1) {
      expect(Math.abs(aiSamples[i]!.aiX! - aiSamples[i - 1]!.aiX!)).toBeLessThan(160);
    }
  });
});
