import { describe, expect, it, vi } from "vitest";

import type { LoadedAtlas } from "../spriteAtlas";
import {
  DEFAULT_CAR_SPRITE_SET,
  resolveCarRenderFrames,
  selectCarFramePlan,
} from "../carSpriteCompositor";

describe("selectCarFramePlan", () => {
  it("returns base plus brake overlay while braking above the speed gate", () => {
    expect(
      selectCarFramePlan({
        frameIndex: 2,
        braking: true,
        nitroActive: false,
        weather: "clear",
        speedMetersPerSecond: 12,
        damageTotal: 0,
      }),
    ).toEqual({
      baseSpriteId: DEFAULT_CAR_SPRITE_SET.clean,
      frameIndex: 2,
      damageTier: 0,
      brakeOverlaySpriteId: DEFAULT_CAR_SPRITE_SET.brake,
    });
  });

  it("returns base plus nitro overlay while nitro is active", () => {
    const plan = selectCarFramePlan({
      frameIndex: 1,
      braking: false,
      nitroActive: true,
      weather: "clear",
      speedMetersPerSecond: 20,
      damageTotal: 0,
    });

    expect(plan.nitroOverlaySpriteId).toBe(DEFAULT_CAR_SPRITE_SET.nitro);
    expect(plan.brakeOverlaySpriteId).toBeUndefined();
  });

  it("adds wet trail above 30 kph in heavy rain", () => {
    const plan = selectCarFramePlan({
      frameIndex: 0,
      braking: false,
      nitroActive: false,
      weather: "heavy_rain",
      speedMetersPerSecond: 50 / 3.6,
      damageTotal: 0,
    });

    expect(plan.trailOverlaySpriteId).toBe(DEFAULT_CAR_SPRITE_SET.wetTrail);
  });

  it("does not add wet trail below the speed gate", () => {
    const plan = selectCarFramePlan({
      frameIndex: 0,
      braking: false,
      nitroActive: false,
      weather: "heavy_rain",
      speedMetersPerSecond: 10 / 3.6,
      damageTotal: 0,
    });

    expect(plan.trailOverlaySpriteId).toBeUndefined();
  });

  it("selects snow trail and never also selects wet trail", () => {
    const plan = selectCarFramePlan({
      frameIndex: 0,
      braking: false,
      nitroActive: false,
      weather: "snow",
      speedMetersPerSecond: 50 / 3.6,
      damageTotal: 0,
    });

    expect(plan.trailOverlaySpriteId).toBe(DEFAULT_CAR_SPRITE_SET.snowTrail);
    expect(plan.trailOverlaySpriteId).not.toBe(DEFAULT_CAR_SPRITE_SET.wetTrail);
  });

  it("uses damage tier 3 as the base frame", () => {
    const plan = selectCarFramePlan({
      frameIndex: 4,
      braking: false,
      nitroActive: false,
      weather: "clear",
      speedMetersPerSecond: 0,
      damageTotal: 0.95,
    });

    expect(plan.damageTier).toBe(3);
    expect(plan.baseSpriteId).toBe(DEFAULT_CAR_SPRITE_SET.damage3);
    expect(plan.damageOverlaySpriteId).toBeUndefined();
  });

  it("is deterministic for the same input", () => {
    const input = {
      frameIndex: 3,
      braking: true,
      nitroActive: true,
      weather: "rain" as const,
      speedMetersPerSecond: 18,
      damageTotal: 0.55,
    };

    expect(selectCarFramePlan(input)).toEqual(selectCarFramePlan(input));
  });
});

describe("resolveCarRenderFrames", () => {
  it("resolves draw frames from an atlas plan", () => {
    const plan = selectCarFramePlan({
      frameIndex: 5,
      braking: true,
      nitroActive: true,
      weather: "rain",
      speedMetersPerSecond: 18,
      damageTotal: 0.55,
    });

    const resolved = resolveCarRenderFrames(loadedAtlas(), plan);

    expect(resolved?.base.x).toBe(5);
    expect(resolved?.trailOverlay?.x).toBe(40);
    expect(resolved?.brakeOverlay?.x).toBe(20);
    expect(resolved?.nitroOverlay?.x).toBe(30);
    expect(resolved?.damageOverlay?.x).toBe(105);
    expect(resolved?.damageTier).toBe(2);
  });

  it("logs a missing optional frame once and skips the overlay", () => {
    const warn = vi.fn();
    const cache = new Set<string>();
    const plan = {
      baseSpriteId: DEFAULT_CAR_SPRITE_SET.clean,
      frameIndex: 0,
      damageTier: 0 as const,
      brakeOverlaySpriteId: "missing_brake",
    };

    const first = resolveCarRenderFrames(loadedAtlas(), plan, {
      logger: { warn },
      warningCache: cache,
    });
    const second = resolveCarRenderFrames(loadedAtlas(), plan, {
      logger: { warn },
      warningCache: cache,
    });

    expect(first?.brakeOverlay).toBeUndefined();
    expect(second?.brakeOverlay).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[car-sprite]",
      'missing sprite frame "missing_brake"',
    );
  });
});

function loadedAtlas(): LoadedAtlas {
  return {
    image: {} as HTMLImageElement,
    fallback: false,
    meta: {
      image: "art/cars/sparrow.svg",
      width: 128,
      height: 192,
      sprites: {
        sparrow_clean: [{ x: 0, y: 0, w: 64, h: 32 }, { x: 5, y: 0, w: 64, h: 32 }],
        sparrow_dented: [{ x: 100, y: 0, w: 64, h: 32 }, { x: 105, y: 0, w: 64, h: 32 }],
        sparrow_battered: [{ x: 100, y: 32, w: 64, h: 32 }, { x: 105, y: 32, w: 64, h: 32 }],
        sparrow_totaled: [{ x: 100, y: 64, w: 64, h: 32 }, { x: 105, y: 64, w: 64, h: 32 }],
        sparrow_brake: [{ x: 20, y: 0, w: 64, h: 32 }],
        sparrow_nitro: [{ x: 30, y: 0, w: 64, h: 32 }],
        sparrow_wet_trail: [{ x: 40, y: 0, w: 64, h: 32 }],
        sparrow_snow_trail: [{ x: 50, y: 0, w: 64, h: 32 }],
      },
    },
  };
}
