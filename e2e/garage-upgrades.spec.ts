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
  };
  progress: { unlockedTours: string[]; completedTours: string[] };
  records: Record<string, unknown>;
}

function buildGarageSave(
  overrides: Partial<SeededSave["garage"]> = {},
): SeededSave {
  return {
    version: 3,
    profileName: "GarageUpgradeTester",
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
      credits: 3500,
      ownedCars: ["sparrow-gt"],
      activeCarId: "sparrow-gt",
      installedUpgrades: {
        "sparrow-gt": defaultUpgradeTiers(),
      },
      ...overrides,
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

test.describe("garage upgrade shop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
  });

  test("buys the next upgrade tier and persists it", async ({ page }) => {
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildGarageSave() },
    );

    await page.goto("/garage/upgrade");

    await expect(page.getByTestId("garage-upgrade-page")).toBeVisible();
    await expect(page.getByTestId("garage-upgrade-credits")).toHaveText("3500");
    await expect(page.getByTestId("garage-upgrade-current-engine")).toContainText(
      "Stock",
    );
    await expect(page.getByTestId("garage-upgrade-next-engine")).toHaveText(
      "Street (3000 credits)",
    );

    await page.getByTestId("buy-upgrade-engine").click();

    await expect(page.getByTestId("garage-upgrade-status")).toContainText(
      "Installed Street Engine",
    );
    await expect(page.getByTestId("garage-upgrade-credits")).toHaveText("500");
    await expect(page.getByTestId("garage-upgrade-current-engine")).toContainText(
      "Street",
    );
    await expect(page.getByTestId("garage-upgrade-reason-engine")).toHaveText(
      "Need 5500 more credits.",
    );

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            garage?: {
              credits?: number;
              installedUpgrades?: Record<string, Record<string, number>>;
            };
          })
        : null;
    }, SAVE_KEY);

    expect(persisted?.garage?.credits).toBe(500);
    expect(persisted?.garage?.installedUpgrades?.["sparrow-gt"]?.engine).toBe(1);

    await page.reload();

    await expect(page.getByTestId("garage-upgrade-credits")).toHaveText("500");
    await expect(page.getByTestId("garage-upgrade-current-engine")).toContainText(
      "Street",
    );
  });
});
