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
  };
  progress: { unlockedTours: string[]; completedTours: string[] };
  records: Record<string, unknown>;
}

function buildGarageSave(overrides: Partial<SeededSave["garage"]> = {}): SeededSave {
  return {
    version: 3,
    profileName: "GarageSummaryTester",
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
      credits: 2400,
      ownedCars: ["sparrow-gt", "breaker-s"],
      activeCarId: "breaker-s",
      installedUpgrades: {
        "sparrow-gt": defaultUpgradeTiers(),
        "breaker-s": {
          ...defaultUpgradeTiers(),
          engine: 2,
          wetTires: 1,
        },
      },
      pendingDamage: {
        "breaker-s": {
          zones: {
            engine: 0.25,
            tires: 0.1,
            body: 0.5,
          },
          total: 0.31,
          offRoadAccumSeconds: 0,
        },
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

test.describe("garage summary", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
  });

  test("shows the active car, credits, upgrades, and action links", async ({
    page,
  }) => {
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildGarageSave() },
    );

    await page.goto("/garage");

    await expect(page.getByTestId("garage-page")).toBeVisible();
    await expect(page.getByTestId("garage-credits")).toHaveText("2400");
    await expect(page.getByTestId("garage-active-car")).toHaveText("Breaker S");
    await expect(page.getByTestId("garage-owned-count")).toHaveText("2");
    await expect(page.getByTestId("garage-damage-summary")).toHaveText(
      "31% pending",
    );
    await expect(page.getByTestId("garage-upgrade-engine")).toHaveText("Tier 2");
    await expect(page.getByTestId("garage-upgrade-wetTires")).toHaveText("Tier 1");

    await page.getByTestId("garage-repair-link").click();
    await expect(page).toHaveURL(/\/garage\/repair$/);
    await expect(page.getByTestId("garage-repair-page")).toBeVisible();

    await page.getByTestId("garage-repair-back").click();
    await page.getByTestId("garage-upgrade-link").click();
    await expect(page).toHaveURL(/\/garage\/upgrade$/);
    await expect(page.getByTestId("garage-upgrade-page")).toBeVisible();
  });

  test("keeps next race text clear of the world tour action", async ({
    page,
  }) => {
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildGarageSave() },
    );

    await page.setViewportSize({ width: 640, height: 720 });
    await page.goto("/garage");

    const card = page.getByTestId("garage-next-card");
    const description = card.getByText(
      "Pick the next World Tour event, then return here for repairs and upgrades between races.",
    );
    const action = card.getByTestId("garage-open-world-tour-link");

    await expect(description).toBeVisible();
    await expect(action).toBeVisible();

    const descriptionBox = await description.boundingBox();
    const actionBox = await action.boundingBox();
    expect(descriptionBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(descriptionBox!.y + descriptionBox!.height).toBeLessThan(
      actionBox!.y,
    );
  });

  test("recovers a save with a missing active car through starter selection", async ({
    page,
  }) => {
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      {
        key: SAVE_KEY,
        save: buildGarageSave({
          activeCarId: "missing-car",
          ownedCars: ["sparrow-gt"],
          installedUpgrades: {},
        }),
      },
    );

    await page.goto("/garage");

    await expect(page.getByTestId("garage-starter-pick")).toBeVisible();
    await expect(page.getByTestId("starter-sparrow-gt")).toBeVisible();
    await expect(page.getByTestId("starter-breaker-s")).toBeVisible();
    await expect(page.getByTestId("starter-vanta-xr")).toBeVisible();
    await page.getByTestId("pick-starter-sparrow-gt").click();
    await expect(page.getByTestId("garage-status")).toContainText(
      "Starter car selected",
    );
    await expect(page.getByTestId("garage-active-car")).toHaveText("Sparrow GT");

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            garage?: {
              activeCarId?: string;
              installedUpgrades?: Record<string, Record<string, number>>;
            };
          })
        : null;
    }, SAVE_KEY);
    expect(persisted?.garage?.activeCarId).toBe("sparrow-gt");
    expect(persisted?.garage?.installedUpgrades?.["sparrow-gt"]?.engine).toBe(0);
  });
});
