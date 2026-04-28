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
    pendingDamage: Record<string, unknown>;
    lastRaceCashEarned: number;
  };
  progress: { unlockedTours: string[]; completedTours: string[] };
  records: Record<string, unknown>;
  ghosts: Record<string, unknown>;
  writeCounter: number;
}

test.describe("world tour hub", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
  });

  test("shows tour cards, locked gates, and starts the first tour", async ({
    page,
  }) => {
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildWorldTourSave() },
    );

    await page.goto("/world");

    await expect(page.getByTestId("world-page")).toBeVisible();
    await expect(page.getByTestId("world-tour-list")).toBeVisible();
    await expect(page.getByTestId("world-tour-velvet-coast")).toBeVisible();
    await expect(page.getByTestId("world-tour-status-velvet-coast")).toHaveText(
      "Available",
    );
    await expect(page.getByTestId("world-tour-first-track-velvet-coast")).toHaveText(
      "Harbor Run",
    );

    await expect(page.getByTestId("world-tour-status-iron-borough")).toHaveText(
      "Locked",
    );
    await expect(page.getByTestId("world-tour-lock-iron-borough")).toContainText(
      "Complete Velvet Coast",
    );
    await expect(page.getByTestId("world-tour-enter-iron-borough")).toBeDisabled();

    await page.getByTestId("world-tour-enter-velvet-coast").click();
    await expect(page).toHaveURL(
      /\/race\/prep\?track=velvet-coast%2Fharbor-run&tour=velvet-coast&raceIndex=0$/,
    );
    await expect(page.getByTestId("pre-race-track")).toHaveText("Harbor Run");
    await expect(page.getByTestId("pre-race-recommended-tire")).toContainText(
      "dry",
    );

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as { progress?: { unlockedTours?: string[] } })
        : null;
    }, SAVE_KEY);

    expect(persisted?.progress?.unlockedTours).toContain("velvet-coast");
  });
});

function buildWorldTourSave(): SeededSave {
  return {
    version: 3,
    profileName: "WorldTourTester",
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
      pendingDamage: {},
      lastRaceCashEarned: 0,
    },
    progress: { unlockedTours: [], completedTours: [] },
    records: {},
    ghosts: {},
    writeCounter: 0,
  };
}
