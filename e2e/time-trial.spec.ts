import { expect, test } from "@playwright/test";

const SAVE_KEY = "vibegear2:save:v4";

test.describe("time trial launch page", () => {
  test("lists unlocked tracks with benchmark targets and PBs", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildSeedSave() },
    );

    await page.goto("/time-trial");

    await expect(page.getByTestId("time-trial-page")).toBeVisible();
    await expect(
      page.getByTestId("time-trial-track-velvet-coast/harbor-run"),
    ).toBeVisible();
    await expect(
      page.getByTestId("time-trial-pb-velvet-coast/harbor-run"),
    ).toHaveText("00:30.000");
    await expect(
      page.getByTestId("time-trial-benchmark-velvet-coast/harbor-run"),
    ).toHaveText("00:31.500");
    await expect(
      page.getByTestId("time-trial-start-velvet-coast/harbor-run"),
    ).toHaveAttribute(
      "href",
      "/race?mode=timeTrial&track=velvet-coast%2Fharbor-run&weather=clear",
    );

    await expect(
      page.getByTestId("time-trial-downloaded-ghost-velvet-coast/harbor-run"),
    ).toHaveText("No time");
    await page
      .getByTestId("time-trial-import-ghost-velvet-coast/harbor-run")
      .setInputFiles({
        name: "harbor-run-rival.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            formatVersion: 1,
            physicsVersion: 1,
            fixedStepMs: 16.666666666666668,
            trackId: "velvet-coast/harbor-run",
            trackVersion: 1,
            carId: "sparrow-gt",
            seed: 123,
            totalTicks: 1860,
            finalTimeMs: 31_000,
            truncated: false,
            deltas: [],
          }),
        ),
      });
    await expect(page.getByTestId("time-trial-ghost-import-status")).toHaveText(
      "Imported downloaded ghost for Harbor Run.",
    );
    await expect(
      page.getByTestId("time-trial-downloaded-ghost-velvet-coast/harbor-run"),
    ).toHaveText("00:31.000");
    await expect(
      page.getByTestId("time-trial-start-downloaded-ghost-velvet-coast/harbor-run"),
    ).toHaveAttribute(
      "href",
      "/race?mode=timeTrial&track=velvet-coast%2Fharbor-run&weather=clear&ghost=downloaded",
    );
  });
});

function buildSeedSave() {
  return {
    version: 4,
    profileName: "Test Driver",
    settings: {
      displaySpeedUnit: "kph",
      assists: {
        steeringAssist: false,
        autoNitro: false,
        weatherVisualReduction: false,
        autoAccelerate: false,
        brakeAssist: false,
        steeringSmoothing: false,
        nitroToggleMode: false,
        reducedSimultaneousInput: false,
      },
      difficultyPreset: "normal",
      transmissionMode: "auto",
    },
    garage: {
      credits: 1000,
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
    },
    records: {
      "velvet-coast/harbor-run": {
        bestLapMs: 30_000,
        bestRaceMs: 90_000,
      },
    },
    ghosts: {},
    downloadedGhosts: {},
    writeCounter: 0,
  };
}
