import { expect, test } from "@playwright/test";

/**
 * F-004: garage save/load Playwright reload-survives-save regression.
 *
 * Closes the e2e gap left by `feat/localstorage-save`. The unit suite in
 * `src/persistence/save.test.ts` covers parse, migrate, write, and shim
 * paths against an in-memory Storage; this spec drives the live React
 * shell so a future refactor that breaks the storage contract surfaces
 * before merge instead of after.
 *
 * Source of truth: `docs/FOLLOWUPS.md` F-004; `docs/gdd/05-core-gameplay-loop.md`
 * (garage flow); `docs/gdd/21-technical-design-for-web-implementation.md`
 * (Save system).
 *
 * Test approach. Seed a customised v3 save into localStorage before
 * navigation, drive the `/garage/cars` UI to mutate `garage.activeCarId`
 * (and a follow-on Buy that mutates `garage.credits` plus
 * `garage.ownedCars`), then reload and confirm the persisted shape on
 * the storage side and the rendered indicators on the UI side match
 * what the click flow produced. The two-mutation round-trip pins the
 * contract that *every* persisted change survives a reload, not just
 * the first one.
 */

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
      colorBlindMode: "off" | "deuter" | "prot" | "trit";
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

/**
 * Seed shape mirrors a default save plus two extra owned cars so the
 * "select non-default" branch is reachable, plus enough credits to
 * cover the cheapest unowned car (`vanta-xr` at 10000) so the Buy
 * branch is reachable on the same fixture.
 */
function buildSeededSave(): SeededSave {
  return {
    version: 3,
    profileName: "PersistenceTester",
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
      credits: 12000,
      ownedCars: ["sparrow-gt", "breaker-s"],
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
        "breaker-s": {
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
}

test.describe("garage save/load reload survives", () => {
  test.beforeEach(async ({ page }) => {
    // Seed via a same-origin navigation so the localStorage write
    // lands on the page origin Playwright is about to navigate to.
    // `goto("/")` is the lightest origin to mount; the title screen
    // does not write the save key on its own so the seed survives
    // intact through the next navigation.
    await page.goto("/");
    const hasStorage = await page.evaluate(
      () => typeof window.localStorage !== "undefined",
    );
    test.skip(!hasStorage, "localStorage unavailable in this browser context");
    await page.evaluate(
      ({ key, save }) => {
        window.localStorage.setItem(key, JSON.stringify(save));
      },
      { key: SAVE_KEY, save: buildSeededSave() },
    );
  });

  test("switching active car persists across reload", async ({ page }) => {
    await page.goto("/garage/cars");

    await expect(page.getByTestId("active-car-id")).toHaveText("sparrow-gt");

    // Activate the seeded second owned car. The button is enabled
    // because `breaker-s` is owned but not active.
    await page.getByTestId("select-breaker-s").click();
    await expect(page.getByTestId("active-car-id")).toHaveText("breaker-s");

    // Storage is the source of truth: assert the v3 shape carries the
    // mutated `activeCarId` before we reload.
    const beforeReload = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as { garage?: { activeCarId?: string } }) : null;
    }, SAVE_KEY);
    expect(beforeReload?.garage?.activeCarId).toBe("breaker-s");

    await page.reload();

    await expect(page.getByTestId("active-car-id")).toHaveText("breaker-s");
    // The active card carries the same Set Active button labelled
    // "Active" (disabled) so the UI agrees with the storage shape.
    await expect(page.getByTestId("select-breaker-s")).toHaveText("Active");
  });

  test("buying a car persists credits + ownedCars across reload", async ({
    page,
  }) => {
    await page.goto("/garage/cars");
    await expect(page.getByTestId("garage-credits")).toHaveText("12000");

    // Vanta XR (10000 credits) is unowned on the seed; the Buy button
    // is enabled because credits >= price.
    await page.getByTestId("buy-vanta-xr").click();

    // Status banner switches to the success message; credits decrement
    // and the card replaces Buy with Set Active.
    await expect(page.getByTestId("garage-status")).toContainText("Purchased");
    await expect(page.getByTestId("garage-credits")).toHaveText("2000");
    await expect(page.getByTestId("select-vanta-xr")).toBeVisible();

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            garage?: {
              credits?: number;
              ownedCars?: string[];
              installedUpgrades?: Record<string, unknown>;
            };
          })
        : null;
    }, SAVE_KEY);
    expect(persisted?.garage?.credits).toBe(2000);
    expect(persisted?.garage?.ownedCars).toEqual(
      expect.arrayContaining(["sparrow-gt", "breaker-s", "vanta-xr"]),
    );
    expect(persisted?.garage?.installedUpgrades?.["vanta-xr"]).toBeDefined();

    await page.reload();

    await expect(page.getByTestId("garage-credits")).toHaveText("2000");
    // The newly purchased car renders a Set Active button rather than
    // a Buy button; the active car id has not changed because the page
    // does not auto-activate purchases.
    await expect(page.getByTestId("select-vanta-xr")).toHaveText("Set Active");
    await expect(page.getByTestId("active-car-id")).toHaveText("sparrow-gt");
  });
});
