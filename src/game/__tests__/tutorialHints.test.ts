/**
 * Unit tests for the F-101 first-race HUD hint trigger module.
 *
 * Pure-function semantics: each case pins one row of the predicate
 * table that `deriveTutorialHint` evaluates. The race page passes the
 * resolved `text` into `TutorialHintOverlay`, so these cases double
 * as the contract for what the player sees.
 */

import { describe, expect, it } from "vitest";

import {
  BRAKE_HINT_CURVE_THRESHOLD,
  BRAKE_HINT_MIN_SPEED_MPS,
  NITRO_HINT_MIN_SPEED_FRACTION,
  NITRO_HINT_STRAIGHT_THRESHOLD,
  deriveTutorialHint,
  type TutorialHintInput,
} from "@/game/tutorialHints";

const STRAIGHT_INPUT: TutorialHintInput = Object.freeze({
  enabled: true,
  upcomingCurveMagnitude: 0,
  playerSpeedMps: 40,
  topSpeedMps: 80,
  authoredCurveMagnitude: 0,
  nitroCharges: 2,
  nitroActive: false,
});

const CORNER_INPUT: TutorialHintInput = Object.freeze({
  enabled: true,
  upcomingCurveMagnitude: BRAKE_HINT_CURVE_THRESHOLD + 0.05,
  playerSpeedMps: BRAKE_HINT_MIN_SPEED_MPS + 5,
  topSpeedMps: 80,
  authoredCurveMagnitude: 0.4,
  nitroCharges: 2,
  nitroActive: false,
});

describe("deriveTutorialHint", () => {
  it("returns null when the gate is disabled", () => {
    expect(deriveTutorialHint({ ...CORNER_INPUT, enabled: false })).toBeNull();
    expect(deriveTutorialHint({ ...STRAIGHT_INPUT, enabled: false })).toBeNull();
  });

  it("fires the brake hint for a fast corner approach", () => {
    const hint = deriveTutorialHint(CORNER_INPUT);
    expect(hint?.id).toBe("brake-before-corner");
  });

  it("does not fire the brake hint when the player is already slow", () => {
    const hint = deriveTutorialHint({
      ...CORNER_INPUT,
      playerSpeedMps: BRAKE_HINT_MIN_SPEED_MPS - 1,
    });
    expect(hint).toBeNull();
  });

  it("does not fire the brake hint when the curve is below threshold", () => {
    const hint = deriveTutorialHint({
      ...CORNER_INPUT,
      upcomingCurveMagnitude: BRAKE_HINT_CURVE_THRESHOLD - 0.01,
    });
    expect(hint?.id).not.toBe("brake-before-corner");
  });

  it("fires the nitro hint on a long straight at mid-band speed", () => {
    const hint = deriveTutorialHint(STRAIGHT_INPUT);
    expect(hint?.id).toBe("tap-nitro");
  });

  it("withholds the nitro hint when the player has no charges", () => {
    const hint = deriveTutorialHint({ ...STRAIGHT_INPUT, nitroCharges: 0 });
    expect(hint).toBeNull();
  });

  it("withholds the nitro hint while a burn is already active", () => {
    const hint = deriveTutorialHint({ ...STRAIGHT_INPUT, nitroActive: true });
    expect(hint).toBeNull();
  });

  it("withholds the nitro hint below the mid-band speed floor", () => {
    const hint = deriveTutorialHint({
      ...STRAIGHT_INPUT,
      playerSpeedMps:
        STRAIGHT_INPUT.topSpeedMps * NITRO_HINT_MIN_SPEED_FRACTION - 1,
    });
    expect(hint).toBeNull();
  });

  it("withholds the nitro hint when the road is not straight enough", () => {
    const hint = deriveTutorialHint({
      ...STRAIGHT_INPUT,
      authoredCurveMagnitude: NITRO_HINT_STRAIGHT_THRESHOLD + 0.01,
    });
    expect(hint).toBeNull();
  });

  it("prefers the brake hint when both predicates would otherwise fire", () => {
    const hint = deriveTutorialHint({
      ...CORNER_INPUT,
      authoredCurveMagnitude: 0,
      nitroCharges: 2,
      nitroActive: false,
    });
    expect(hint?.id).toBe("brake-before-corner");
  });

  it("returns null when topSpeedMps is zero so the nitro fraction is undefined", () => {
    const hint = deriveTutorialHint({ ...STRAIGHT_INPUT, topSpeedMps: 0 });
    expect(hint).toBeNull();
  });
});
