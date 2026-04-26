import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Profile export / import round-trip in /options Profile pane
 * (GDD §20 Save and load: 'Manual profile export / import',
 * 'Versioned save migrations'). Pure parse and serialise have unit
 * coverage in `src/persistence/__tests__/profileExport.test.ts`; this
 * spec drives the live React shell, the file dialog, and the
 * localStorage round-trip.
 */

const SAVE_KEY = "vibegear2:save:v3";

test.describe("options profile pane", () => {
  test.beforeEach(async ({ page }) => {
    // Auto-confirm the Clear save dialog so the test path is
    // deterministic without polluting other specs.
    page.on("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.goto("/");
    await page.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, SAVE_KEY);
  });

  test("renders the Profile tab with Export, Import, and Clear buttons", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-profile").click();

    await expect(page.getByTestId("profile-section")).toBeVisible();
    await expect(page.getByTestId("profile-export-button")).toBeVisible();
    await expect(page.getByTestId("profile-import-button")).toBeVisible();
    await expect(page.getByTestId("profile-clear-button")).toBeVisible();
  });

  test("export downloads a JSON file with the documented filename pattern", async ({
    page,
  }) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-profile").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("profile-export-button").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^vibegear2-profile-\d{8}T\d{6}Z\.json$/,
    );

    const tmpFile = path.join(
      mkdtempSync(path.join(tmpdir(), "vibegear2-export-")),
      download.suggestedFilename(),
    );
    await download.saveAs(tmpFile);
    const contents = JSON.parse(readFileSync(tmpFile, "utf-8")) as {
      version: number;
      profileName: string;
    };
    expect(contents.version).toBe(3);
    expect(contents.profileName).toBe("Player");
  });

  test("export, clear, and re-import round-trips the save through localStorage", async ({
    page,
  }) => {
    // Seed a customised save so the round-trip has a non-default
    // signature to assert against. We mutate via the in-page save API
    // by writing localStorage directly (the same shape the persistence
    // layer reads).
    await page.evaluate((key) => {
      const seed = {
        version: 2,
        profileName: "ExportTester",
        settings: {
          displaySpeedUnit: "mph",
          assists: {
            steeringAssist: false,
            autoNitro: false,
            weatherVisualReduction: false,
          },
          difficultyPreset: "hard",
          transmissionMode: "manual",
          audio: { master: 0.7, music: 0.6, sfx: 0.5 },
          accessibility: {
            colorBlindMode: "off",
            reducedMotion: true,
            largeUiText: false,
            screenShakeScale: 0.4,
          },
          keyBindings: {
            accelerate: ["ArrowUp", "KeyW"],
            brake: ["ArrowDown", "KeyS"],
            left: ["ArrowLeft", "KeyA"],
            right: ["ArrowRight", "KeyD"],
            nitro: ["Space"],
            handbrake: ["ShiftLeft", "ShiftRight"],
            pause: ["Escape"],
            shiftUp: ["KeyE"],
            shiftDown: ["KeyQ"],
          },
        },
        garage: {
          credits: 12345,
          ownedCars: ["sparrow-gt"],
          activeCarId: "sparrow-gt",
          installedUpgrades: {
            "sparrow-gt": {
              engine: 1,
              gearbox: 1,
              dryTires: 1,
              wetTires: 1,
              nitro: 1,
              armor: 0,
              cooling: 0,
              aero: 0,
            },
          },
        },
        progress: { unlockedTours: [], completedTours: [] },
        records: {},
      };
      window.localStorage.setItem(key, JSON.stringify(seed));
    }, SAVE_KEY);

    await page.goto("/options");
    await page.getByTestId("options-tab-profile").click();

    await expect(page.getByTestId("profile-summary-credits")).toHaveText(
      "12345",
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("profile-export-button").click();
    const download = await downloadPromise;
    const tmpFile = path.join(
      mkdtempSync(path.join(tmpdir(), "vibegear2-export-")),
      download.suggestedFilename(),
    );
    await download.saveAs(tmpFile);

    // Clear save: dialog accept is wired in beforeEach.
    await page.getByTestId("profile-clear-button").click();
    await expect(page.getByTestId("profile-status")).toHaveAttribute(
      "data-status",
      "info",
    );
    await expect(page.getByTestId("profile-summary-credits")).toHaveText("0");

    // Confirm the localStorage entry is gone.
    const cleared = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      SAVE_KEY,
    );
    expect(cleared).toBeNull();

    // Import the file back.
    await page
      .getByTestId("profile-import-input")
      .setInputFiles(tmpFile);
    await expect(page.getByTestId("profile-summary-credits")).toHaveText(
      "12345",
    );

    const restored = await page.evaluate(
      (key) => JSON.parse(window.localStorage.getItem(key) ?? "null"),
      SAVE_KEY,
    );
    expect(restored?.profileName).toBe("ExportTester");
    expect(restored?.garage?.credits).toBe(12345);
    expect(restored?.settings?.difficultyPreset).toBe("hard");
  });

  test("import surfaces a schema error for malformed payloads", async ({
    page,
  }, testInfo) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-profile").click();

    const tmpFile = path.join(
      testInfo.outputPath("malformed-save.json"),
    );
    writeFileSync(tmpFile, "{not valid json", "utf-8");

    await page
      .getByTestId("profile-import-input")
      .setInputFiles(tmpFile);

    await expect(page.getByTestId("profile-status")).toHaveAttribute(
      "data-status",
      "error",
    );
    await expect(page.getByTestId("profile-status")).toContainText(
      "Could not parse",
    );
  });

  test("import surfaces a future-version error", async ({ page }, testInfo) => {
    await page.goto("/options");
    await page.getByTestId("options-tab-profile").click();

    const futureSave = {
      version: 99,
      profileName: "Time Traveller",
      settings: {
        displaySpeedUnit: "kph",
        assists: {
          steeringAssist: false,
          autoNitro: false,
          weatherVisualReduction: false,
        },
      },
      garage: {
        credits: 0,
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
      },
      progress: { unlockedTours: [], completedTours: [] },
      records: {},
    };
    const tmpFile = path.join(testInfo.outputPath("future-save.json"));
    writeFileSync(tmpFile, JSON.stringify(futureSave), "utf-8");

    await page
      .getByTestId("profile-import-input")
      .setInputFiles(tmpFile);

    await expect(page.getByTestId("profile-status")).toHaveAttribute(
      "data-status",
      "error",
    );
    await expect(page.getByTestId("profile-status")).toContainText(
      "newer version",
    );
  });
});
