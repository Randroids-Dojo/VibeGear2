import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SAVE_KEY = "vibegear2:save:v4";
const ENABLED = process.env.RELEASE_FUN_PLAYTEST === "1";
const PRODUCTION_URL = process.env.RELEASE_FUN_PRODUCTION_URL;
const EXPECTED_VERSION = process.env.RELEASE_FUN_EXPECTED_VERSION;

interface Evidence {
  route: string;
  viewport: { width: number; height: number } | null;
  browser: string;
  checkpoints: Record<string, boolean | number | string | null>;
}

test.describe("release-fun playtest checklist", () => {
  test.skip(!ENABLED, "Set RELEASE_FUN_PLAYTEST=1 to run the release-fun checklist.");

  test("script A records first 90-second quick race evidence", async ({
    browserName,
    page,
  }, testInfo) => {
    test.setTimeout(160_000);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/quick-race");
    await expect(page.getByTestId("quick-race-page")).toBeVisible();
    await expect(page.getByTestId("quick-race-track")).toHaveValue(
      "velvet-coast/harbor-run",
    );

    await page.getByTestId("quick-race-start").click();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });
    const track = await page.getByTestId("race-canvas").getAttribute("data-track");
    const mode = await page.getByTestId("race-canvas").getAttribute("data-mode");
    const canvas = page.getByTestId("race-canvas-element");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await page.keyboard.down("Space");
    await expect(page.getByTestId("race-player-nitro-active")).toHaveText(
      "yes",
      { timeout: 5_000 },
    );
    await page.keyboard.up("Space");

    const samples: Array<{
      elapsedMs: number;
      visibleAi: number;
      visiblePickups: number;
      collectedPickups: number;
      speed: number;
      aiWidthDepth: number | null;
      roadHalfWidth: number | null;
      url: string;
    }> = [];
    const startedAt = Date.now();
    const stopAt = startedAt + 90_000;
    while (Date.now() < stopAt && !page.url().includes("/race/results")) {
      samples.push({
        elapsedMs: Date.now() - startedAt,
        visibleAi: await numberText(page, "race-visible-ai-count", 0),
        visiblePickups: await numberText(page, "race-visible-pickup-count", 0),
        collectedPickups: await numberText(
          page,
          "race-collected-pickup-count",
          0,
        ),
        speed: await numberText(page, "hud-speed", 0),
        aiWidthDepth: await optionalNumberText(page, "race-ai-width-depth-product"),
        roadHalfWidth: await optionalNumberText(page, "race-road-near-half-width"),
        url: page.url(),
      });
      await page.waitForTimeout(2_000);
    }
    await page.keyboard.up("ArrowUp");

    const firstAiAt = samples.find((sample) => sample.visibleAi > 0)?.elapsedMs;
    const maxVisiblePickups = Math.max(...samples.map((sample) => sample.visiblePickups));
    const maxCollectedPickups = Math.max(
      ...samples.map((sample) => sample.collectedPickups),
    );
    const maxSpeed = Math.max(...samples.map((sample) => sample.speed));
    const roadHalfWidthSamples = samples
      .map((sample) => sample.roadHalfWidth)
      .filter((value): value is number => value !== null && value > 0);
    const aiWidthDepthSamples = samples
      .map((sample) => sample.aiWidthDepth)
      .filter((value): value is number => value !== null && value > 0);
    const roadJumps = adjacentMaxRatio(roadHalfWidthSamples);
    const aiScaleJumps = adjacentMaxRatio(aiWidthDepthSamples);

    await attachEvidence(testInfo, "script-a-first-90-seconds", {
      route: "/quick-race",
      viewport: page.viewportSize(),
      browser: browserName,
      checkpoints: {
        track,
        mode,
        firstAiAt: firstAiAt ?? null,
        maxVisiblePickups,
        maxCollectedPickups,
        maxSpeed,
        roadSampleCount: roadHalfWidthSamples.length,
        aiScaleSampleCount: aiWidthDepthSamples.length,
        roadJumps,
        aiScaleJumps,
        endedOnResults: page.url().includes("/race/results"),
      },
    });

    expect(firstAiAt).not.toBeUndefined();
    expect(firstAiAt ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(25_000);
    expect(maxVisiblePickups).toBeGreaterThan(0);
    expect(maxCollectedPickups).toBeGreaterThan(0);
    expect(maxSpeed).toBeGreaterThan(120);
    expect(roadHalfWidthSamples.length).toBeGreaterThanOrEqual(4);
    expect(aiWidthDepthSamples.length).toBeGreaterThanOrEqual(2);
    expect(roadJumps).toBeLessThan(1.6);
    expect(aiScaleJumps).toBeLessThan(1.8);
  });

  test("script B drives a full quick race into the garage", async ({
    browserName,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    await page.goto("/quick-race");
    await page.getByTestId("quick-race-start").click();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    const canvas = page.getByTestId("race-canvas-element");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect(page).toHaveURL(/\/race\/results/, { timeout: 90_000 });
    await page.keyboard.up("ArrowUp");

    await expect(page.getByTestId("race-results")).toBeVisible();
    await expect(page.getByTestId("results-placement")).toBeVisible();
    await expect(page.getByTestId("results-rewards-panel")).toBeVisible();
    await expect(page.getByTestId("results-fastest-lap")).toBeVisible();
    await expect(page.getByTestId("results-cta-continue")).toBeVisible();

    await attachEvidence(testInfo, "script-b-full-quick-race", {
      route: "/quick-race",
      viewport: page.viewportSize(),
      browser: browserName,
      checkpoints: {
        placement: await textContent(page, "results-placement"),
        cash: await textContent(page, "results-cash"),
        credits: await textContent(page, "results-credits-awarded"),
        ctaVisible: true,
      },
    });

    await page.getByTestId("results-cta-continue").click();
    await expect(page).toHaveURL(/\/garage$/);
    await expect(page.getByTestId("garage-page")).toBeVisible();
  });

  test("script C proves first tour handoff does not strand the player", async ({
    browserName,
    page,
  }, testInfo) => {
    test.setTimeout(80_000);

    await seedSave(page, buildSave({ credits: 5000 }));
    await page.goto("/world");
    await page.getByTestId("world-tour-enter-velvet-coast").click();
    await expect(page.getByTestId("pre-race-page")).toBeVisible();
    await expect(page.getByTestId("pre-race-tour")).toContainText("Velvet Coast");
    await page.getByTestId("pre-race-start-link").click();

    await finishRace(page, 45_000);
    await expect(page.getByTestId("results-standings-panel")).toBeVisible();
    await expect(page.getByTestId("results-cta-continue-tour")).toBeVisible();
    await attachEvidence(testInfo, "script-c-first-tour-chain", {
      route: "/world",
      viewport: page.viewportSize(),
      browser: browserName,
      checkpoints: {
        resultTrack: await page.getByTestId("race-results").getAttribute("data-track"),
        standingsVisible: true,
        continueTourText: await textContent(page, "results-cta-continue-tour"),
      },
    });

    await page.getByTestId("results-cta-continue-tour").click();
    await expect(page).toHaveURL(/raceIndex=1$/);
  });

  test("scripts D and E cover upgrade purchase and weather prep", async ({
    browserName,
    page,
  }, testInfo) => {
    await seedSave(page, buildSave({ credits: 3500 }));

    await page.goto("/garage/upgrade");
    await expect(page.getByTestId("garage-upgrade-page")).toBeVisible();
    await page.getByTestId("buy-upgrade-engine").click();
    await expect(page.getByTestId("garage-upgrade-status")).toContainText(
      "Installed Street Engine",
    );
    const persisted = await readSave(page);
    expect(persisted?.garage?.installedUpgrades?.["sparrow-gt"]?.engine).toBe(1);

    await page.goto(
      "/race/prep?track=velvet-coast%2Fharbor-run&tour=velvet-coast&raceIndex=0&weather=rain",
    );
    await expect(page.getByTestId("pre-race-weather")).toHaveText("Rain");
    await expect(page.getByTestId("pre-race-recommended-tire")).toContainText(
      "wet",
    );
    await expect(page.getByTestId("pre-race-tire-wet")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByTestId("pre-race-start-link").click();
    await expect(page).toHaveURL(/weather=rain/);
    await expect(page).toHaveURL(/tire=wet/);
    await expect(page.getByTestId("race-canvas")).toBeVisible();

    await attachEvidence(testInfo, "scripts-d-e-upgrade-weather-prep", {
      route: "/garage/upgrade and /race/prep",
      viewport: page.viewportSize(),
      browser: browserName,
      checkpoints: {
        engineTier: persisted?.garage?.installedUpgrades?.["sparrow-gt"]?.engine ?? null,
        weather: "rain",
        selectedTire: "wet",
      },
    });
  });

  test("scripts F, G, and H cover AI pressure, pickup feedback, and finish routing", async ({
    browserName,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    await page.goto("/race?track=test/straight&mode=quickRace");
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });
    const canvas = page.getByTestId("race-canvas-element");
    await canvas.focus();
    await page.keyboard.down("ArrowUp");

    await expect
      .poll(async () => numberText(page, "race-visible-ai-count", 0), {
        timeout: 25_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => numberText(page, "race-visible-pickup-count", 0), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => numberText(page, "race-collected-pickup-count", 0), {
        timeout: 25_000,
      })
      .toBeGreaterThan(0);
    await expect(page.getByTestId("race-last-pickup-kind")).toHaveText("cash", {
      timeout: 25_000,
    });
    await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
    await page.keyboard.up("ArrowUp");
    await expect(page.getByTestId("race-results")).toBeVisible();

    await attachEvidence(testInfo, "scripts-f-g-h-ai-pickup-finish", {
      route: "/race?track=test/straight&mode=quickRace",
      viewport: page.viewportSize(),
      browser: browserName,
      checkpoints: {
        pickupKind: "cash",
        resultsVisible: true,
        resultTrack: await page.getByTestId("race-results").getAttribute("data-track"),
      },
    });
  });

  test("script I smokes production when configured", async ({
    browserName,
    page,
  }, testInfo) => {
    test.skip(!PRODUCTION_URL, "Set RELEASE_FUN_PRODUCTION_URL for production smoke.");

    const base = PRODUCTION_URL!.replace(/\/$/, "");
    const versionResponse = await page.request.get(`${base}/api/version`);
    expect(versionResponse.ok()).toBe(true);
    const version = (await versionResponse.json()) as { version?: string };
    if (EXPECTED_VERSION) {
      expect(version.version).toBe(EXPECTED_VERSION);
    }

    await page.goto(base);
    await expect(page.getByTestId("game-title")).toBeVisible();
    await page.goto(`${base}/quick-race`);
    await page.getByTestId("quick-race-start").click();
    await expect(page.getByTestId("race-canvas-element")).toBeVisible();
    await expect.poll(() => canvasHasPaint(page), { timeout: 10_000 }).toBe(true);

    await attachEvidence(testInfo, "script-i-production-smoke", {
      route: base,
      viewport: page.viewportSize(),
      browser: browserName,
      checkpoints: {
        version: version.version ?? null,
        expectedVersion: EXPECTED_VERSION ?? null,
        canvasPainted: true,
      },
    });
  });
});

async function attachEvidence(
  testInfo: TestInfo,
  name: string,
  evidence: Evidence,
): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
}

async function finishRace(page: Page, timeout: number): Promise<void> {
  const canvas = page.getByTestId("race-canvas-element");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("race-phase")).toHaveText("racing", {
    timeout: 10_000,
  });
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await expect(page).toHaveURL(/\/race\/results/, { timeout });
  await page.keyboard.up("ArrowUp");
  await expect(page.getByTestId("race-results")).toBeVisible();
}

async function numberText(
  page: Page,
  testId: string,
  fallback: number,
): Promise<number> {
  const value = await optionalNumberText(page, testId);
  return value ?? fallback;
}

async function optionalNumberText(page: Page, testId: string): Promise<number | null> {
  const text = await textContent(page, testId);
  if (!text || text === "none") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

async function textContent(page: Page, testId: string): Promise<string | null> {
  return page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    return element?.textContent?.trim() ?? null;
  }, testId);
}

function adjacentMaxRatio(values: number[]): number {
  let maxRatio = 1;
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined) continue;
    if (previous <= 0 || current <= 0) continue;
    maxRatio = Math.max(
      maxRatio,
      Math.max(previous, current) / Math.min(previous, current),
    );
  }
  return maxRatio;
}

async function canvasHasPaint(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="race-canvas-element"]',
    );
    if (!canvas) return false;
    const context = canvas.getContext("2d");
    if (!context) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 3; index < data.length; index += 4) {
      if ((data[index] ?? 0) > 0) return true;
    }
    return false;
  });
}

async function seedSave(page: Page, save: ReturnType<typeof buildSave>): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ({ key, payload }) => window.localStorage.setItem(key, JSON.stringify(payload)),
    { key: SAVE_KEY, payload: save },
  );
}

async function readSave(page: Page): Promise<ReturnType<typeof buildSave> | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ReturnType<typeof buildSave>) : null;
  }, SAVE_KEY);
}

function buildSave({ credits }: { credits: number }) {
  return {
    version: 4,
    profileName: "ReleaseFunTester",
    settings: {
      displaySpeedUnit: "kph",
      assists: {
        steeringAssist: false,
        autoNitro: false,
        weatherVisualReduction: false,
      },
      difficultyPreset: "easy",
      transmissionMode: "auto",
      audio: { master: 1, music: 1, sfx: 1 },
      accessibility: {
        colorBlindMode: "off",
        reducedMotion: false,
        largeUiText: false,
        screenShakeScale: 1,
      },
    },
    garage: {
      credits,
      ownedCars: ["sparrow-gt"],
      activeCarId: "sparrow-gt",
      installedUpgrades: {
        "sparrow-gt": {
          engine: 0,
          gearbox: 0,
          dryTires: 0,
          wetTires: 0,
          nitro: 0,
          armor: 0,
          cooling: 0,
          aero: 0,
        },
      },
      pendingDamage: {},
      lastRaceCashEarned: 0,
    },
    progress: { unlockedTours: ["velvet-coast"], completedTours: [] },
    records: {},
    ghosts: {},
    writeCounter: 0,
  };
}
