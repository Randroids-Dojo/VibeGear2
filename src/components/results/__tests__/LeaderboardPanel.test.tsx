import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LeaderboardPanel } from "../LeaderboardPanel";

/**
 * SSR-shape contract for `LeaderboardPanel`. The repo has no
 * `@testing-library/react` dependency; the four submitLap-result
 * branches are exercised by `leaderboardPanelState.test.ts` against
 * the pure model. This file pins the env-gate render guard:
 *
 *   - `enabledOverride: false` renders nothing (the panel is hidden
 *     entirely when the leaderboard env flag is off).
 *   - `enabledOverride: true` renders the panel shell with the idle
 *     status pill (the effect that fires submitLap / getTop has not
 *     run yet under SSR).
 *
 * The interactive flows belong in `e2e/results-screen.spec.ts`.
 */

describe("LeaderboardPanel SSR shell", () => {
  it("renders nothing when the env flag is off", () => {
    const html = renderToStaticMarkup(
      createElement(LeaderboardPanel, {
        trackId: "test/straight",
        carId: "sparrow-gt",
        bestLapMs: 67_450,
        playerFinished: true,
        enabledOverride: false,
      }),
    );
    expect(html).toBe("");
  });

  it("renders the panel shell with the idle pill when enabled", () => {
    const html = renderToStaticMarkup(
      createElement(LeaderboardPanel, {
        trackId: "test/straight",
        carId: "sparrow-gt",
        bestLapMs: 67_450,
        playerFinished: true,
        enabledOverride: true,
      }),
    );
    expect(html).toContain('data-testid="leaderboard-panel"');
    expect(html).toContain('data-status="idle"');
    expect(html).toContain('data-track="test/straight"');
    expect(html).toContain("Submitting lap...");
  });

  it("renders the dnf short-circuit when the player did not finish", () => {
    const html = renderToStaticMarkup(
      createElement(LeaderboardPanel, {
        trackId: "test/straight",
        carId: "sparrow-gt",
        bestLapMs: null,
        playerFinished: false,
        enabledOverride: true,
      }),
    );
    expect(html).toContain('data-status="dnf"');
    expect(html).toContain("Lap not submitted (DNF).");
  });

  it("never includes an em-dash in rendered copy (project rule)", () => {
    const html = renderToStaticMarkup(
      createElement(LeaderboardPanel, {
        trackId: "test/straight",
        carId: "sparrow-gt",
        bestLapMs: 67_450,
        playerFinished: true,
        enabledOverride: true,
      }),
    );
    expect(html).not.toMatch(/[–—]/u);
  });
});
