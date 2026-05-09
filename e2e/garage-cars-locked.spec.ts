import { expect, test } from "@playwright/test";

/**
 * F-097 follow-on. Pins the locked-state UX on the garage cars
 * subroute so a tour-gated car (bastion-lm requires iron-borough)
 * surfaces a disabled Buy with a "Win Iron Borough to unlock"
 * reason copy when the player has not completed the prerequisite
 * tour. Mirrors the unit test in
 * `src/components/garage/__tests__/...` but exercises the live
 * route plus the championship-name resolver.
 */

const SAVE_KEY = "vibegear2:save:v4";

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

test.describe("garage cars locked state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
  });

  test("bastion-lm is locked until Iron Borough is completed", async ({
    page,
  }) => {
    // Seed a save with cash to spare but no completed tours; the
    // tour-gated cars should refuse purchase regardless of credits.
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildLockedSave([]) },
    );

    await page.goto("/garage/cars");
    await expect(page.getByTestId("car-card-bastion-lm")).toBeVisible();

    const buyButton = page.getByTestId("buy-bastion-lm");
    await expect(buyButton).toBeVisible();
    await expect(buyButton).toBeDisabled();
    await expect(buyButton).toHaveText("Locked");

    const reason = page.getByTestId("lock-reason-bastion-lm");
    await expect(reason).toBeVisible();
    await expect(reason).toHaveText("Win Iron Borough to unlock.");
  });

  test("bastion-lm Buy unlocks once Iron Borough is in completedTours", async ({
    page,
  }) => {
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildLockedSave(["iron-borough"]) },
    );

    await page.goto("/garage/cars");
    await expect(page.getByTestId("car-card-bastion-lm")).toBeVisible();
    await expect(page.getByTestId("lock-reason-bastion-lm")).toHaveCount(0);

    const buyButton = page.getByTestId("buy-bastion-lm");
    await expect(buyButton).toBeVisible();
    // Save has 200_000 credits, well above bastion-lm.purchasePrice;
    // the gate is open and the button is enabled with a price label.
    await expect(buyButton).toBeEnabled();
    await expect(buyButton).toContainText("Buy");
  });
});

function buildLockedSave(completedTours: ReadonlyArray<string>): SeededSave {
  return {
    version: 4,
    profileName: "LockedStateTester",
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
      credits: 200_000,
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
    progress: {
      unlockedTours: [],
      completedTours: completedTours.slice(),
    },
    records: {},
    ghosts: {},
    writeCounter: 0,
  };
}
