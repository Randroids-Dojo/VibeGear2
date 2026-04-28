import { expect, test } from "@playwright/test";

const SAVE_KEY = "vibegear2:save:v3";

test.describe("World Tour race progression", () => {
  test("final Velvet Coast race unlocks Iron Borough", async ({ page }) => {
    test.setTimeout(70_000);

    await page.goto("/");
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildFinalRaceSave() },
    );

    await page.goto(
      "/race?track=velvet-coast%2Flighthouse-fall&tour=velvet-coast&raceIndex=3",
    );

    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-track",
      "velvet-coast/lighthouse-fall",
    );
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
    await page.keyboard.up("ArrowUp");

    await expect(page.getByTestId("results-tour-complete")).toContainText(
      "Tour complete",
    );
    await expect(page.getByTestId("results-tour-complete")).toContainText(
      "Iron Borough",
    );

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            progress?: {
              activeTour?: unknown;
              completedTours?: string[];
              unlockedTours?: string[];
            };
          })
        : null;
    }, SAVE_KEY);

    expect(persisted?.progress?.activeTour).toBeUndefined();
    expect(persisted?.progress?.completedTours).toContain("velvet-coast");
    expect(persisted?.progress?.unlockedTours).toContain("iron-borough");

    await page.goto("/world");
    await expect(page.getByTestId("world-tour-status-iron-borough")).toHaveText(
      "Available",
    );
  });
});

function buildFinalRaceSave() {
  return {
    version: 3,
    profileName: "TourFlowTester",
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
    progress: {
      unlockedTours: ["velvet-coast"],
      completedTours: [],
      activeTour: {
        tourId: "velvet-coast",
        raceIndex: 3,
        results: [
          {
            trackId: "velvet-coast/harbor-run",
            placement: 1,
            dnf: false,
            cashEarned: 1000,
          },
          {
            trackId: "velvet-coast/sunpier-loop",
            placement: 1,
            dnf: false,
            cashEarned: 1000,
          },
          {
            trackId: "velvet-coast/cliffline-arc",
            placement: 1,
            dnf: false,
            cashEarned: 1000,
          },
        ],
      },
    },
    records: {},
    ghosts: {},
    writeCounter: 0,
  };
}
