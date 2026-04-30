import { expect, test } from "@playwright/test";

const SAVE_KEY = "vibegear2:save:v4";

test.describe("pre-race tire selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildSave() },
    );
  });

  test("shows forecast fields and carries wet tires into race start", async ({
    page,
  }) => {
    await page.goto(
      "/race/prep?track=velvet-coast%2Fharbor-run&tour=velvet-coast&raceIndex=0&weather=rain",
    );

    await expect(page.getByTestId("pre-race-page")).toBeVisible();
    await expect(page.getByTestId("pre-race-track")).toHaveText("Harbor Run");
    await expect(page.getByTestId("pre-race-weather")).toHaveText("Rain");
    await expect(page.getByTestId("pre-race-recommended-tire")).toContainText(
      "wet",
    );
    await expect(page.getByTestId("pre-race-tire-wet")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("pre-race-car")).toHaveText("Sparrow GT");
    await page.getByTestId("pre-race-tire-dry").click();
    await expect(page.getByTestId("pre-race-tire-dry")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("pre-race-tire-warning")).toContainText(
      "wet tires",
    );
    await page.getByTestId("pre-race-tire-wet").click();
    await page.getByTestId("pre-race-start-link").click();
    await expect(page).toHaveURL(
      /\/race\?track=velvet-coast%2Fharbor-run&weather=rain&tire=wet&tour=velvet-coast&raceIndex=0$/,
    );
    await expect(page.getByTestId("race-canvas")).toBeVisible();
  });
});

function buildSave() {
  return {
    version: 4,
    profileName: "PreRaceTester",
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
    progress: { unlockedTours: ["velvet-coast"], completedTours: [] },
    records: {},
    ghosts: {},
    writeCounter: 0,
  };
}
