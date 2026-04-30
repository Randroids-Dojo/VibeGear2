import { expect, test } from "@playwright/test";

const SAVE_KEY = "vibegear2:save:v4";

/**
 * Natural race-finish e2e per F-038. Drives a single-lap race on
 * `test/straight` with the throttle held down so the player reaches the
 * line, then asserts the route hops to `/race/results` and renders the
 * §20 results screen with the player row.
 *
 * Coordinated with sibling dot
 * `VibeGear2-implement-e2e-race-4a750bfc` (F-029): that dot owns the
 * fuller multi-lap spec captured in the second `describe` below; this
 * one is the focused natural-finish-wires-to-results contract for
 * F-038. The two are complementary and not redundant: F-029 stresses
 * the multi-lap + AI-on-the-grid surface, this spec pins the wiring
 * boundary.
 */

test.describe("race-finish wiring (F-038)", () => {
  test(
    "natural finish on test/straight routes to /race/results with the player row",
    async ({ page }) => {
      // The single-lap straight track is 1,200 m; Sparrow GT tops out at
      // 61 m/s so a full-throttle lap completes in ~20 s of sim time
      // plus the 3 s countdown. Pad the timeout to absorb CI jitter.
      test.setTimeout(60_000);

      await page.goto("/race?track=test/straight");

      const canvas = page.getByTestId("race-canvas-element");
      await expect(canvas).toBeVisible();

      // Wait for the countdown to clear so input is sampled.
      await expect(page.getByTestId("race-phase")).toHaveText("racing", {
        timeout: 10_000,
      });

      // Drive the throttle until the route hops. The keydown listener is
      // attached to the document, so a focused canvas is not strictly
      // required, but match the existing race-demo spec for clarity.
      await canvas.focus();
      await page.keyboard.down("ArrowUp");

      // The natural-finish wiring tears down the loop and pushes the
      // router to /race/results once the player crosses the line. The
      // URL assertion is the load-bearing contract per the F-038
      // verify list.
      await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
      await page.keyboard.up("ArrowUp");

      // Results page rendered the §20 root and the player row. The row
      // identifier (`results-row-player`) matches the
      // `<FinishingOrderTable />` testid pattern asserted by the
      // results-screen spec, so a regression in the §20 surface is
      // caught in both places.
      await expect(page.getByTestId("race-results")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByTestId("race-results")).toHaveAttribute(
        "data-track",
        "test/straight",
      );
      await expect(page.getByTestId("results-row-player")).toBeVisible();
      // A natural finish carries the `finished` status (vs DNF on the
      // retire-path spec).
      await expect(page.getByTestId("results-row-player")).toHaveAttribute(
        "data-status",
        "finished",
      );
      // Continue CTA renders so the player can return to the garage.
      await expect(page.getByTestId("results-cta-continue")).toBeVisible();

      // F-034: the natural-finish wiring credits the wallet via
      // `awardCredits` and stamps the delta on `creditsAwarded`. A
      // single-lap straight finish at P1 (no AI on this spec, so the
      // player wins by default) pays the §23 tier-1 base reward times
      // the §12 1.0 multiplier, plus podium + clean-race bonuses if the
      // bonus pipeline awards them. Assert the row renders with a non-
      // zero credit count so a regression that drops the wallet commit
      // (e.g. the helper omits `creditsAwarded`) fails here.
      const creditsRow = page.getByTestId("results-credits-awarded");
      await expect(creditsRow).toBeVisible();
      await expect(creditsRow).not.toHaveText(/^0 cr$/);
    },
  );

  test(
    "natural finish persists active car damage for the repair shop",
    async ({ page }) => {
      test.setTimeout(70_000);

      await page.goto("/");
      await page.evaluate(
        ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
        { key: SAVE_KEY, save: buildRaceDamageSave() },
      );

      await page.goto("/race?track=test/straight");

      const canvas = page.getByTestId("race-canvas-element");
      await expect(canvas).toBeVisible();
      await expect(page.getByTestId("race-phase")).toHaveText("racing", {
        timeout: 10_000,
      });

      await canvas.focus();
      await page.keyboard.down("ArrowUp");
      await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
      await page.keyboard.up("ArrowUp");

      const persisted = await page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        return raw
          ? (JSON.parse(raw) as {
              garage?: {
                credits?: number;
                lastRaceCashEarned?: number;
                pendingDamage?: Record<
                  string,
                  { zones?: { engine?: number; tires?: number; body?: number } }
                >;
              };
            })
          : null;
      }, SAVE_KEY);

      expect(persisted?.garage?.credits).toBeGreaterThan(1000);
      expect(persisted?.garage?.lastRaceCashEarned).toBeGreaterThan(0);
      const bodyDamage =
        persisted?.garage?.pendingDamage?.["sparrow-gt"]?.zones?.body ?? 0;
      expect(bodyDamage).toBeGreaterThanOrEqual(0.33);

      await page.getByTestId("results-cta-continue").click();
      await expect(page).toHaveURL(/\/garage$/);
      await page.goto("/garage/repair");

      await expect(page.getByTestId("garage-repair-page")).toBeVisible();
      await expect(page.getByTestId("garage-repair-damage-body")).toContainText(
        `${Math.round(bodyDamage * 100)}% damage`,
      );
    },
  );
});

/**
 * Multi-lap race-finish e2e per F-029. Closes
 * `VibeGear2-implement-e2e-race-4a750bfc`. Drives a full three-lap
 * race against the bundled clean-line AI on `test/straight` (the
 * lowest-curvature track in the bundle, so a held-throttle player
 * cannot drift into the verge). The race page now honours an optional
 * `?laps=N` URL override per the matching change in
 * `src/app/race/page.tsx`; the bundled `test/straight` data file pins
 * `laps: 1` so the e2e supplies the override at the URL boundary
 * rather than mutating fixture content.
 *
 * Verifies (per task description): a multi-lap race against AI ends
 * with the §20 results overlay rendered, with both the player row and
 * the demo AI row present, and the totalLaps banner reflecting the
 * override.
 */

test.describe("race-finish wiring (F-029 multi-lap)", () => {
  test(
    "multi-lap race vs AI on test/straight ends at /race/results with both rows",
    async ({ page }) => {
      // Three laps of test/straight is 3,600 m. Sparrow GT tops out at
      // 61 m/s and the §3 race-rules hard cap is 600 s, so the natural
      // finish lands around ~60 s of sim time plus the 3 s countdown.
      // The CI box runs the loop at fixed step in real time, so pad
      // generously above the analytical floor.
      test.setTimeout(180_000);

      await page.goto("/race?track=test/straight&laps=3");

      const canvas = page.getByTestId("race-canvas-element");
      await expect(canvas).toBeVisible();

      // The HUD lap label is the first place we can sanity-check that
      // the `?laps=` override actually threaded into the session
      // config: a regression that drops the override would surface
      // here as `1 / 1` instead of `1 / 3` and fail the assert before
      // the slow finish wait.
      await expect(page.getByTestId("hud-lap")).toHaveText("1 / 3", {
        timeout: 10_000,
      });

      // Wait for the lights-out so the throttle below actually counts.
      await expect(page.getByTestId("race-phase")).toHaveText("racing", {
        timeout: 10_000,
      });

      // Hold the throttle until the natural-finish wiring tears down
      // the loop and routes to /race/results. The keyup is issued
      // after the route hop so any stray frame between the post-lap
      // tick and the unmount cannot leave a stuck input.
      await canvas.focus();
      await page.keyboard.down("ArrowUp");
      await expect(page).toHaveURL(/\/race\/results/, { timeout: 150_000 });
      await page.keyboard.up("ArrowUp");

      // §20 root rendered with the source track id stamped on the
      // banner, plus both the player and the single-AI rows seeded by
      // the demo grid in `src/app/race/page.tsx`.
      const root = page.getByTestId("race-results");
      await expect(root).toBeVisible({ timeout: 10_000 });
      await expect(root).toHaveAttribute("data-track", "test/straight");
      await expect(page.getByTestId("results-row-player")).toBeVisible();
      await expect(page.getByTestId("results-row-ai-0")).toBeVisible();

      // The player crossed the line under their own throttle, so the
      // row carries the `finished` status (the DNF path is owned by
      // the pause-actions retire spec).
      await expect(page.getByTestId("results-row-player")).toHaveAttribute(
        "data-status",
        "finished",
      );

      // Continue CTA is the §20 default focus; assert it renders so a
      // post-finish navigation regression fails here too.
      await expect(page.getByTestId("results-cta-continue")).toBeVisible();
    },
  );
});

test.describe("time trial PB persistence", () => {
  test("finished time trial writes PB records without credits or damage", async ({
    page,
  }) => {
    test.setTimeout(70_000);

    await page.goto("/");
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildRaceDamageSave() },
    );

    await page.goto("/race?mode=timeTrial&track=test/straight");
    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
    await page.keyboard.up("ArrowUp");

    await expect(page.getByTestId("results-credits-awarded")).toHaveText("0 cr");

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            garage?: {
              credits?: number;
              pendingDamage?: Record<
                string,
                { zones?: { body?: number }; total?: number }
              >;
            };
            records?: Record<string, { bestLapMs?: number; bestRaceMs?: number }>;
          })
        : null;
    }, SAVE_KEY);

    expect(persisted?.garage?.credits).toBe(1000);
    expect(
      persisted?.garage?.pendingDamage?.["sparrow-gt"]?.zones?.body ?? 0,
    ).toBe(0.33);
    expect(persisted?.records?.["test/straight"]?.bestLapMs).toBeGreaterThan(0);
    expect(persisted?.records?.["test/straight"]?.bestRaceMs).toBeGreaterThan(0);
  });
});

test.describe("quick race result persistence", () => {
  test("finished quick race keeps economy and damage out of the save", async ({
    page,
  }) => {
    test.setTimeout(70_000);

    await page.goto("/");
    await page.evaluate(
      ({ key, save }) => window.localStorage.setItem(key, JSON.stringify(save)),
      { key: SAVE_KEY, save: buildRaceDamageSave() },
    );

    await page.goto(
      "/race?mode=quickRace&track=test/straight&weather=clear&car=sparrow-gt",
    );
    await expect(page.getByTestId("race-canvas")).toHaveAttribute(
      "data-mode",
      "quickRace",
    );
    await expect(page.getByTestId("race-field-size")).not.toHaveText("1");
    const canvas = page.getByTestId("race-canvas-element");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("race-phase")).toHaveText("racing", {
      timeout: 10_000,
    });

    await canvas.focus();
    await page.keyboard.down("ArrowUp");
    await expect(page).toHaveURL(/\/race\/results/, { timeout: 45_000 });
    await page.keyboard.up("ArrowUp");

    await expect(page.getByTestId("results-credits-awarded")).toHaveText("0 cr");

    const persisted = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as {
            garage?: {
              credits?: number;
              pendingDamage?: Record<
                string,
                { zones?: { body?: number }; total?: number }
              >;
            };
            records?: Record<string, { bestLapMs?: number; bestRaceMs?: number }>;
          })
        : null;
    }, SAVE_KEY);

    expect(persisted?.garage?.credits).toBe(1000);
    expect(
      persisted?.garage?.pendingDamage?.["sparrow-gt"]?.zones?.body ?? 0,
    ).toBe(0.33);
    expect(persisted?.records?.["test/straight"]?.bestLapMs).toBeGreaterThan(0);
    expect(persisted?.records?.["test/straight"]?.bestRaceMs).toBeGreaterThan(0);
  });
});

function buildRaceDamageSave() {
  return {
    version: 4,
    profileName: "RaceDamageTester",
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
      pendingDamage: {
        "sparrow-gt": {
          zones: { engine: 0, tires: 0, body: 0.33 },
          total: 0.1155,
          offRoadAccumSeconds: 0,
        },
      },
      lastRaceCashEarned: 0,
    },
    progress: { unlockedTours: [], completedTours: [] },
    records: {},
    ghosts: {},
    writeCounter: 0,
  };
}
