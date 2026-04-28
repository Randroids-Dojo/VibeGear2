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
    pendingDamage?: Record<
      string,
      {
        zones: { engine: number; tires: number; body: number };
        total: number;
        offRoadAccumSeconds: number;
      }
    >;
    lastRaceCashEarned?: number;
  };
  progress: { unlockedTours: string[]; completedTours: string[] };
  records: Record<string, unknown>;
}

function buildGarageSave(): SeededSave {
  return {
    version: 3,
    profileName: "GarageRepairTester",
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
        "sparrow-gt": defaultUpgradeTiers(),
      },
      pendingDamage: {
        "sparrow-gt": {
          zones: {
            engine: 0.5,
            tires: 0.25,
            body: 0.5,
          },
          total: 0.45,
          offRoadAccumSeconds: 2,
        },
      },
      lastRaceCashEarned: 2000,
    },
    progress: { unlockedTours: [], completedTours: [] },
    records: {},
  };
}

function defaultUpgradeTiers(): Record<string, number> {
  return {
    engine: 0,
    gearbox: 0,
    dryTires: 0,
    wetTires: 0,
    nitro: 0,
    armor: 0,
    cooling: 0,
    aero: 0,
  };
}

test.describe("garage repair shop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
  });

  test("buys an essential repair and persists remaining damage", async ({
    page,
  }) => {
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildGarageSave() },
    );

    await page.goto("/garage/repair");

    await expect(page.getByTestId("garage-repair-page")).toBeVisible();
    await expect(page.getByTestId("garage-repair-credits")).toHaveText("5000");
    await expect(page.getByTestId("garage-repair-damage-engine")).toContainText(
      "50% damage",
    );
    await expect(page.getByTestId("garage-repair-cost-essential")).toHaveText(
      "800",
    );
    await expect(page.getByTestId("garage-repair-saved-essential")).toContainText(
      "saved 100",
    );

    await page.getByTestId("garage-repair-button-essential").click();

    await expect(page.getByTestId("garage-repair-status")).toContainText(
      "Essential repair complete",
    );
    await expect(page.getByTestId("garage-repair-credits")).toHaveText("4200");
    await expect(page.getByTestId("garage-repair-damage-engine")).toContainText(
      "0% damage",
    );
    await expect(page.getByTestId("garage-repair-damage-body")).toContainText(
      "50% damage",
    );

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            garage?: {
              credits?: number;
              pendingDamage?: Record<
                string,
                { zones?: { engine?: number; tires?: number; body?: number } }
              >;
            };
          })
        : null;
    }, SAVE_KEY);

    expect(persisted?.garage?.credits).toBe(4200);
    expect(
      persisted?.garage?.pendingDamage?.["sparrow-gt"]?.zones?.engine,
    ).toBe(0);
    expect(
      persisted?.garage?.pendingDamage?.["sparrow-gt"]?.zones?.tires,
    ).toBe(0);
    expect(
      persisted?.garage?.pendingDamage?.["sparrow-gt"]?.zones?.body,
    ).toBe(0.5);

    await page.reload();

    await expect(page.getByTestId("garage-repair-credits")).toHaveText("4200");
    await expect(page.getByTestId("garage-repair-damage-body")).toContainText(
      "50% damage",
    );
  });
});
