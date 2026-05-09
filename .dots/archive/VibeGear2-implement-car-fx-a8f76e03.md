---
title: "implement: car FX sprite frames (brake light / nitro glow / wet spray / snow trail / damage variants) per §16"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:22:32.722621-05:00\\\"\""
closed-at: "2026-04-29T17:17:04.506532-05:00"
close-reason: "Merged PR #101, addressed Copilot threads, CI green, production smoke passed at 203d3b7."
blocks:
  - VibeGear2-implement-sprite-atlas-056db61b
  - VibeGear2-implement-placeholder-art-d68d1ee2
  - VibeGear2-implement-vfx-flash-3d33b035
---

## Description

Author the per-car FX sprite frames listed in `docs/gdd/16-rendering-and-visual-design.md` Car sprites: brake light frame, nitro glow frame, wet spray variant, snow trail variant, plus the three damage variants. The placeholder-art dot ships idle / brake / turn frames; this dot ships the FX overlays that compose with those base frames at runtime. Currently no dot owns the FX-frame catalogue or the runtime selection logic.

## Context

§16 lists six sprite expressions per car: 12-16 directional frames, 3 damage variants, brake light, nitro glow, wet spray, snow trail. The atlas loader (`sprite-atlas-056db61b`) supports arbitrary frame indices; this dot pins which frames each car must ship and how they compose.

`implement-vfx-flash-3d33b035` ships screen-level flash and shake. This dot is sprite-level (per-car overlays drawn on top of the base car sprite), not screen-level.

## Affected Files

- `src/render/carSpriteCompositor.ts` (new): pure function `selectCarFrames(car, runtimeState) => CarRenderFrames`. Returns `{base: AtlasFrame, brakeOverlay?: AtlasFrame, nitroOverlay?: AtlasFrame, wetTrail?: AtlasFrame, snowTrail?: AtlasFrame, damageTier: 0|1|2|3}`. No I/O.
- `src/render/__tests__/carSpriteCompositor.test.ts` (new): cell-level fixtures.
- `src/render/carRenderer.ts` (update): drawcall sequence per `CarRenderFrames` (base, then per-overlay).
- `src/data/atlas/cars.json` (update): every car entry adds frame indices for `brake`, `nitro`, `wetTrail`, `snowTrail`, `damage1`, `damage2`, `damage3`.
- `src/render/__tests__/carRenderer.test.ts` (update): mock-canvas asserts the overlay drawcalls fire conditionally.
- `public/art/cars/<car-id>/{brake,nitro,wetTrail,snowTrail,damage1,damage2,damage3}.png` (new placeholder PNGs per car).
- `public/art/manifest.json` (update via placeholder-art-d68d1ee2): list every new file with author + license + originality.
- `scripts/check-art-manifest.ts` (no change): existing guardrail catches missing entries.

## Pinned compositor logic

```ts
function selectCarFrames(car, runtime) {
  const base = directionalFrame(car, runtime.steerDeg);
  const brakeOverlay = runtime.input.brake ? car.brakeFrame : undefined;
  const nitroOverlay = runtime.nitroActive ? car.nitroFrame : undefined;
  const wetTrail = (runtime.weather === "rain" || runtime.weather === "heavy_rain") && runtime.speed > 30
    ? car.wetTrailFrame : undefined;
  const snowTrail = runtime.weather === "snow" && runtime.speed > 30
    ? car.snowTrailFrame : undefined;
  const damageTier = damageBucket(runtime.damageTotal); // 0..3
  return { base, brakeOverlay, nitroOverlay, wetTrail, snowTrail, damageTier };
}
```

## Edge Cases

- Two trail effects (wet + snow) are mutually exclusive per weather kind; compositor never returns both.
- Damage tier 3 (catastrophic): base car frame is replaced by the `damage3` frame so silhouette degrades; tier 1-2 are overlays.
- Brake at zero speed: brake overlay does not render (no taillight when stationary).
- Nitro overlay: gated on actual nitro firing (per `implement-nitro-system-13d9d490`), not on the player holding the key without charge.
- Reduced-motion gate: nitro and brake overlays still render (they convey state); only screen-level flash is suppressed.
- Atlas miss for an FX frame: compositor logs once and skips the overlay; base car still renders. Ensure existing magenta-fallback path still works.

## Verify

- [ ] `selectCarFrames` for `(brake=true, nitro=false, weather=clear)` returns base + brakeOverlay only.
- [ ] `(brake=false, nitro=true)` returns base + nitroOverlay only.
- [ ] `(weather=heavy_rain, speed=50)` returns base + wetTrail.
- [ ] `(weather=heavy_rain, speed=10)` returns base only (speed gate).
- [ ] `(weather=snow, speed=50)` returns base + snowTrail; never both wet and snow.
- [ ] `(damage=0.95)` returns `damageTier: 3` and the base swaps to the damage3 frame.
- [ ] Mock-canvas drawcall ordering: base, then trail, then brake, then nitro, then damage overlays (front-to-back per layer).
- [ ] Atlas miss for `brakeFrame`: compositor logs once and skips; subsequent calls do not re-log (memoized warning set).
- [ ] Determinism: same input -> same output.
- [ ] Manifest test: every new placeholder PNG is listed in `public/art/manifest.json`.
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/render/carSpriteCompositor.ts src/data/atlas/cars.json` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/16-rendering-and-visual-design.md` Car sprites, Animation and effects
- `docs/gdd/17-art-direction.md` Asset resolution and export guidance
- `docs/gdd/24-content-plan.md` Asset list (6 car sets)
