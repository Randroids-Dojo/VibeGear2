/**
 * Vitest suite for the audio-event to VFX-state bridge.
 *
 * Pins the bridge's contract that iter-8 found unwired: a player impact
 * event must push exactly one shake AND one flash, a lapComplete event
 * must push one flash with no shake, and rival-car events must be
 * filtered out so opponents do not jolt the player camera.
 */

import { describe, expect, it } from "vitest";

import {
  applyAudioEventToVfx,
  applyAudioEventsToVfx,
} from "@/app/race/vfxBridge";
import type {
  RaceSessionAudioEvent,
  RaceSessionImpactAudioEvent,
} from "@/game/raceSession";
import {
  INITIAL_VFX_STATE,
  refreshReducedMotionPreference,
} from "@/render/vfx";

const PLAYER_ID = "player";
const RIVAL_ID = "ai-1";

const isPlayer = (carId: string): boolean => carId === PLAYER_ID;

function impactEvent(
  hitKind: RaceSessionImpactAudioEvent["hitKind"],
  carId: string = PLAYER_ID,
): RaceSessionImpactAudioEvent {
  return { kind: "impact", carId, hitKind, speedFactor: 0.7 };
}

describe("applyAudioEventToVfx", () => {
  beforeEachReducedMotionReset();

  it("wallHit pushes one shake and one flash", () => {
    const next = applyAudioEventToVfx(
      INITIAL_VFX_STATE,
      impactEvent("wallHit"),
      { tick: 100, carIsPlayer: isPlayer },
    );
    expect(next.shakes.length).toBe(1);
    expect(next.flashes.length).toBe(1);
    expect(next.flashes[0]!.color).toBe("#ffffff");
    expect(next.flashes[0]!.intensity).toBeCloseTo(0.45, 5);
    expect(next.shakes[0]!.amplitudePx).toBe(14);
  });

  it("carHit uses the lighter shake amplitude and intensity", () => {
    const next = applyAudioEventToVfx(
      INITIAL_VFX_STATE,
      impactEvent("carHit"),
      { tick: 200, carIsPlayer: isPlayer },
    );
    expect(next.shakes.length).toBe(1);
    expect(next.flashes.length).toBe(1);
    expect(next.shakes[0]!.amplitudePx).toBe(9);
    expect(next.flashes[0]!.intensity).toBeCloseTo(0.32, 5);
  });

  it("rub uses the orange flash and the small shake", () => {
    const next = applyAudioEventToVfx(
      INITIAL_VFX_STATE,
      impactEvent("rub"),
      { tick: 300, carIsPlayer: isPlayer },
    );
    expect(next.shakes.length).toBe(1);
    expect(next.flashes.length).toBe(1);
    expect(next.flashes[0]!.color).toBe("#ffaa00");
    expect(next.shakes[0]!.amplitudePx).toBe(4);
  });

  it("filters out rival impacts (opponents do not jolt the player camera)", () => {
    const next = applyAudioEventToVfx(
      INITIAL_VFX_STATE,
      impactEvent("wallHit", RIVAL_ID),
      { tick: 400, carIsPlayer: isPlayer },
    );
    expect(next).toBe(INITIAL_VFX_STATE);
  });

  it("lapComplete pushes one gold flash and no shake", () => {
    const event: RaceSessionAudioEvent = {
      kind: "lapComplete",
      carId: PLAYER_ID,
      lap: 2,
    };
    const next = applyAudioEventToVfx(INITIAL_VFX_STATE, event, {
      tick: 500,
      carIsPlayer: isPlayer,
    });
    expect(next.flashes.length).toBe(1);
    expect(next.shakes.length).toBe(0);
    expect(next.flashes[0]!.color).toBe("#ffd700");
    expect(next.flashes[0]!.durationMs).toBe(360);
  });

  it("raceFinish pushes a longer gold flash", () => {
    const event: RaceSessionAudioEvent = {
      kind: "raceFinish",
      carId: PLAYER_ID,
    };
    const next = applyAudioEventToVfx(INITIAL_VFX_STATE, event, {
      tick: 600,
      carIsPlayer: isPlayer,
    });
    expect(next.flashes.length).toBe(1);
    expect(next.flashes[0]!.durationMs).toBe(600);
    expect(next.flashes[0]!.intensity).toBeCloseTo(0.7, 5);
  });

  it("non-VFX audio kinds (nitroEngage, gearShift, brakeScrub, ...) leave state unchanged", () => {
    const cases: RaceSessionAudioEvent[] = [
      { kind: "nitroEngage", carId: PLAYER_ID },
      { kind: "gearShift", carId: PLAYER_ID, fromGear: 2, toGear: 3 },
      { kind: "brakeScrub", carId: PLAYER_ID, speedFactor: 0.8 },
      { kind: "tireSqueal", carId: PLAYER_ID, speedFactor: 0.8 },
      {
        kind: "pickupCollected",
        carId: PLAYER_ID,
        pickupKind: "cash",
        value: 50,
      },
      {
        kind: "damageWarning",
        carId: PLAYER_ID,
        damagePercent: 0.7,
      },
    ];
    for (const event of cases) {
      const next = applyAudioEventToVfx(INITIAL_VFX_STATE, event, {
        tick: 700,
        carIsPlayer: isPlayer,
      });
      expect(next).toBe(INITIAL_VFX_STATE);
    }
  });
});

describe("applyAudioEventsToVfx (stream)", () => {
  beforeEachReducedMotionReset();

  it("preserves order: two impacts in one tick produce two shake entries", () => {
    const next = applyAudioEventsToVfx(
      INITIAL_VFX_STATE,
      [impactEvent("wallHit"), impactEvent("rub")],
      { tick: 800, carIsPlayer: isPlayer },
    );
    expect(next.shakes.length).toBe(2);
    expect(next.flashes.length).toBe(2);
    expect(next.shakes[0]!.amplitudePx).toBe(14);
    expect(next.shakes[1]!.amplitudePx).toBe(4);
  });

  it("seeds shakes deterministically from tick + hitKind", () => {
    const a = applyAudioEventsToVfx(
      INITIAL_VFX_STATE,
      [impactEvent("wallHit")],
      { tick: 999, carIsPlayer: isPlayer },
    );
    const b = applyAudioEventsToVfx(
      INITIAL_VFX_STATE,
      [impactEvent("wallHit")],
      { tick: 999, carIsPlayer: isPlayer },
    );
    expect(a.shakes[0]!.seed).toBe(b.shakes[0]!.seed);
    const c = applyAudioEventsToVfx(
      INITIAL_VFX_STATE,
      [impactEvent("wallHit")],
      { tick: 1000, carIsPlayer: isPlayer },
    );
    expect(a.shakes[0]!.seed).not.toBe(c.shakes[0]!.seed);
  });

  it("filters mixed player and rival events; only player-side fire", () => {
    const next = applyAudioEventsToVfx(
      INITIAL_VFX_STATE,
      [
        impactEvent("wallHit", RIVAL_ID),
        impactEvent("carHit"),
        impactEvent("wallHit", RIVAL_ID),
      ],
      { tick: 1100, carIsPlayer: isPlayer },
    );
    expect(next.shakes.length).toBe(1);
    expect(next.flashes.length).toBe(1);
    expect(next.shakes[0]!.amplitudePx).toBe(9);
  });
});

function beforeEachReducedMotionReset(): void {
  // Reduced-motion is cached per module load; reset between tests so a
  // future test that flips matchMedia does not contaminate siblings.
  refreshReducedMotionPreference();
}
