import { expect, test } from "@playwright/test";

/**
 * Race results screen e2e per `dot VibeGear2-implement-race-results-7b0abfaa`.
 *
 * The race-finish wiring is owned by a separate slice; this spec seeds a
 * canonical `RaceResult` directly into sessionStorage and asserts the
 * results page renders the seven §20 fields plus both CTAs. The
 * sessionStorage shape is documented at
 * `src/components/results/raceResultStorage.ts`.
 *
 * Coverage:
 *   - Renders finishing order (one row per car), points, cash, bonuses,
 *     damage bars, fastest lap, and the next-race card.
 *   - "Continue to Garage" CTA navigates to /garage/cars.
 *   - Direct nav to /race/results with no seed renders the empty fallback.
 *   - Default focus lands on the Continue CTA.
 */

const STORAGE_KEY = "vibegear2:race-result:v1";

const SEED_RESULT = {
  trackId: "test-circuit",
  totalLaps: 3,
  finishingOrder: [
    {
      carId: "player",
      status: "finished",
      raceTimeMs: 90_000,
      bestLapMs: 30_000,
    },
    {
      carId: "ai-1",
      status: "finished",
      raceTimeMs: 92_000,
      bestLapMs: 30_500,
    },
    {
      carId: "ai-2",
      status: "dnf",
      raceTimeMs: null,
      bestLapMs: null,
    },
  ],
  playerCarId: "player",
  playerPlacement: 1,
  // Base 1000 (§23 difficulty-1) plus rate-driven bonuses: podium P1
  // 0.10 = 100, fastest 0.08 = 80, clean 0.05 = 50. Total 1,230.
  cashEarned: 1230,
  cashBaseEarned: 1000,
  // F-034: wallet delta the race-finish wiring credited. Equals
  // `cashEarned` for an economy mode (Quick Race / Championship); this
  // seed exercises the receipt-mirror happy path.
  creditsAwarded: 1230,
  pointsEarned: 25,
  bonuses: [
    { kind: "podium", label: "Podium finish", cashCredits: 100 },
    { kind: "fastestLap", label: "Fastest lap", cashCredits: 80 },
    { kind: "cleanRace", label: "Clean race", cashCredits: 50 },
  ],
  damageTaken: { engine: 0, tires: 0, body: 0 },
  fastestLap: { carId: "player", lapMs: 30_000, lapNumber: 1 },
  nextRace: { trackId: "next-circuit", laps: 3 },
  recordsUpdated: { trackId: "test-circuit", bestLapMs: 30_000 },
};

test.describe("race results screen", () => {
  test("renders all seven §20 fields and both CTAs", async ({ page }) => {
    await page.goto("/race/results");

    // Seed the handoff slot then reload so the page picks it up on mount.
    await page.evaluate(
      ([key, payload]) => {
        sessionStorage.setItem(key, payload);
      },
      [STORAGE_KEY, JSON.stringify(SEED_RESULT)] as const,
    );
    await page.reload();

    const root = page.getByTestId("race-results");
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute("data-track", "test-circuit");

    // 1. Finishing order: three rows.
    const order = page.getByTestId("results-finishing-order");
    await expect(order).toBeVisible();
    await expect(page.getByTestId("results-row-player")).toBeVisible();
    await expect(page.getByTestId("results-row-ai-1")).toBeVisible();
    await expect(page.getByTestId("results-row-ai-2")).toBeVisible();
    // DNF row carries the dnf status.
    await expect(page.getByTestId("results-row-ai-2")).toHaveAttribute(
      "data-status",
      "dnf",
    );

    // 2. Points earned.
    await expect(page.getByTestId("results-points")).toHaveText("25");

    // 3. Cash earned.
    await expect(page.getByTestId("results-cash")).toContainText("1,230");

    // F-034 wallet-delta row mirrors the cashEarned total for an
    // economy mode; the §20 results screen renders it on its own row so
    // the player sees the credit they actually received.
    await expect(page.getByTestId("results-credits-awarded")).toContainText(
      "1,230",
    );

    // 4. Bonuses: chips for the three awarded.
    await expect(page.getByTestId("results-bonus-podium")).toBeVisible();
    await expect(page.getByTestId("results-bonus-fastestLap")).toBeVisible();
    await expect(page.getByTestId("results-bonus-cleanRace")).toBeVisible();

    // 5. Damage taken: zero across all zones.
    await expect(page.getByTestId("results-damage-engine-percent")).toHaveText(
      "0%",
    );
    await expect(page.getByTestId("results-damage-tires-percent")).toHaveText(
      "0%",
    );
    await expect(page.getByTestId("results-damage-body-percent")).toHaveText(
      "0%",
    );

    // 6. Fastest lap.
    await expect(page.getByTestId("results-fastest-lap")).toContainText(
      "player",
    );
    await expect(page.getByTestId("results-fastest-lap")).toContainText(
      "00:30.000",
    );

    // 7. Next race card.
    await expect(page.getByTestId("results-next-race")).toContainText(
      "next-circuit",
    );

    // CTAs present and Continue is the default focus.
    const cont = page.getByTestId("results-cta-continue");
    const rematch = page.getByTestId("results-cta-rematch");
    await expect(cont).toBeVisible();
    await expect(rematch).toBeVisible();
    await expect(cont).toBeFocused();
  });

  test("Continue to Garage CTA routes to /garage/cars", async ({ page }) => {
    await page.goto("/race/results");
    await page.evaluate(
      ([key, payload]) => {
        sessionStorage.setItem(key, payload);
      },
      [STORAGE_KEY, JSON.stringify(SEED_RESULT)] as const,
    );
    await page.reload();

    await expect(page.getByTestId("results-cta-continue")).toBeVisible();
    await page.getByTestId("results-cta-continue").click();
    await expect(page).toHaveURL(/\/garage\/cars/);
  });

  test("direct nav with no result renders the empty fallback", async ({
    page,
  }) => {
    // Make sure there is no leftover seed in sessionStorage.
    await page.goto("/race/results");
    await page.evaluate((key) => sessionStorage.removeItem(key), STORAGE_KEY);
    await page.reload();

    await expect(page.getByTestId("race-results-empty")).toBeVisible();
    await expect(page.getByTestId("results-cta-home")).toBeVisible();
  });
});
