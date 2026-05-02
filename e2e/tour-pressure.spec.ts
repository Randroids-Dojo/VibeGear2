import { expect, test } from "@playwright/test";

const SAVE_KEY = "vibegear2:save:v4";

test.describe("first tour pressure surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildInProgressTourSave() },
    );
  });

  test("shows standings and economy pressure in garage and pre-race", async ({
    page,
  }) => {
    await page.goto("/garage");
    await expect(page.getByTestId("garage-tour-pressure")).toBeVisible();
    await expect(page.getByTestId("garage-pressure-tour")).toHaveText(
      "Velvet Coast",
    );
    await expect(page.getByTestId("garage-pressure-progress")).toHaveText(
      "Race 2 of 4, 1 complete",
    );
    await expect(page.getByTestId("garage-pressure-gate")).toContainText(
      "4th or better",
    );
    await expect(
      page.getByTestId("garage-pressure-upgrade-shortfall"),
    ).toContainText("cr");

    await page.goto(
      "/race/prep?track=velvet-coast%2Fsunpier-loop&tour=velvet-coast&raceIndex=1",
    );
    await expect(page.getByTestId("pre-race-tour-pressure")).toBeVisible();
    await expect(page.getByTestId("pre-race-pressure-standing")).toContainText(
      "of",
    );
    await expect(page.getByTestId("pre-race-pressure-gate")).toContainText(
      "4th or better",
    );
    await expect(
      page.getByTestId("pre-race-pressure-next-upgrade"),
    ).toContainText("Street");
  });
});

function buildInProgressTourSave() {
  return {
    version: 4,
    profileName: "TourPressureTester",
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
      credits: 1500,
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
          zones: { engine: 0.1, tires: 0.2, body: 0.05 },
          total: 0.115,
          offRoadAccumSeconds: 0,
        },
      },
      lastRaceCashEarned: 700,
    },
    progress: {
      unlockedTours: ["velvet-coast"],
      completedTours: [],
      activeTour: {
        tourId: "velvet-coast",
        raceIndex: 1,
        results: [
          {
            trackId: "velvet-coast/harbor-run",
            placement: 6,
            dnf: false,
            cashEarned: 700,
          },
        ],
      },
    },
    records: {},
    ghosts: {},
    downloadedGhosts: {},
    writeCounter: 0,
  };
}
