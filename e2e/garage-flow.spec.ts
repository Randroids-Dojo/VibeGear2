import { expect, test } from "@playwright/test";

const SAVE_KEY = "vibegear2:save:v3";

interface SeededSave {
  version: number;
  profileName: string;
  settings: {
    displaySpeedUnit: "kph" | "mph";
    assists: {
      steeringAssist: boolean;
      autoNitro: boolean;
      weatherVisualReduction: boolean;
    };
    difficultyPreset: "easy" | "normal" | "hard" | "master";
    transmissionMode: "auto" | "manual";
    audio: { master: number; music: number; sfx: number };
    accessibility: {
      colorBlindMode: "off" | "protanopia" | "deuteranopia" | "tritanopia";
      reducedMotion: boolean;
      largeUiText: boolean;
      screenShakeScale: number;
    };
  };
  garage: {
    credits: number;
    ownedCars: ReadonlyArray<string>;
    activeCarId: string;
    installedUpgrades: Record<string, Record<string, number>>;
    pendingDamage: Record<
      string,
      {
        zones: { engine: number; tires: number; body: number };
        total: number;
        offRoadAccumSeconds: number;
      }
    >;
    lastRaceCashEarned: number;
  };
  progress: { unlockedTours: string[]; completedTours: string[] };
  records: Record<string, unknown>;
  ghosts: Record<string, unknown>;
  writeCounter: number;
}

test.describe("garage flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
  });

  test("finishes a race, services the car, buys an upgrade, and starts the next race", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildGarageFlowSave() },
    );

    await page.goto("/race?track=test/straight");

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
    await page.keyboard.up("ArrowUp");

    await page.getByTestId("results-cta-continue").click();
    await expect(page).toHaveURL(/\/garage$/);
    await expect(page.getByTestId("garage-page")).toBeVisible();
    await expect(page.getByTestId("garage-damage-summary")).toContainText(
      "pending",
    );
    await expect(page.getByTestId("garage-repair-link")).toBeVisible();
    await expect(page.getByTestId("garage-upgrade-link")).toBeVisible();
    await expect(page.getByTestId("garage-next-race-link")).toBeVisible();

    await page.getByTestId("garage-repair-link").click();
    await expect(page).toHaveURL(/\/garage\/repair$/);
    await expect(page.getByTestId("garage-repair-page")).toBeVisible();
    await page.getByTestId("garage-repair-button-full").click();
    await expect(page.getByTestId("garage-repair-status")).toContainText(
      "Full service complete",
    );
    await expect(page.getByTestId("garage-repair-damage-body")).toContainText(
      "0% damage",
    );

    await page.getByTestId("garage-repair-back").click();
    await expect(page).toHaveURL(/\/garage$/);
    await page.getByTestId("garage-upgrade-link").click();
    await expect(page).toHaveURL(/\/garage\/upgrade$/);
    await expect(page.getByTestId("garage-upgrade-page")).toBeVisible();
    await page.getByTestId("buy-upgrade-engine").click();
    await expect(page.getByTestId("garage-upgrade-status")).toContainText(
      "Installed Street Engine",
    );
    await expect(page.getByTestId("garage-upgrade-current-engine")).toContainText(
      "Street",
    );

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            garage?: {
              pendingDamage?: Record<
                string,
                { zones?: { engine?: number; tires?: number; body?: number } }
              >;
              installedUpgrades?: Record<string, Record<string, number>>;
            };
          })
        : null;
    }, SAVE_KEY);

    expect(
      persisted?.garage?.pendingDamage?.["sparrow-gt"]?.zones?.body,
    ).toBe(0);
    expect(persisted?.garage?.installedUpgrades?.["sparrow-gt"]?.engine).toBe(1);

    await page.getByTestId("garage-upgrade-back").click();
    await page.getByTestId("garage-next-race-link").click();
    await expect(page).toHaveURL(/\/race$/);
    await expect(page.getByTestId("race-canvas-element")).toBeVisible();
  });
});

function buildGarageFlowSave(): SeededSave {
  return {
    version: 3,
    profileName: "GarageFlowTester",
    settings: {
      displaySpeedUnit: "kph",
      assists: {
        steeringAssist: false,
        autoNitro: false,
        weatherVisualReduction: false,
      },
      difficultyPreset: "normal",
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
      credits: 5000,
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
      pendingDamage: {
        "sparrow-gt": {
          zones: { engine: 0, tires: 0, body: 0.33 },
          total: 0.1155,
          offRoadAccumSeconds: 0,
        },
      },
      lastRaceCashEarned: 0,
    },
    progress: { unlockedTours: [], completedTours: [] },
    records: {},
    ghosts: {},
    writeCounter: 0,
  };
}
