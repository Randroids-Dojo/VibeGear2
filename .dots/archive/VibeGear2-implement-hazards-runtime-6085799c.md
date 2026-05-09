---
title: "implement: hazards runtime engine (puddle / cone / sign / gravel band / snow buildup) per §9 §13 §23"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:22:29.266382-05:00\\\"\""
closed-at: "2026-04-28T04:30:23.234717-05:00"
close-reason: "Merged hazards runtime via PR #41 and review-fix PR #42, addressed threaded review comments, green main CI, automated production deploy restored after rotating VERCEL_TOKEN, and production smoke returned 200s."
blocks:
  - VibeGear2-implement-damage-model-765f2bb9
  - VibeGear2-implement-weather-38d61fc2
  - VibeGear2-implement-off-road-2f037c64
---

## Description

Implement the hazards runtime that consumes the per-segment `hazards` field from the §22 Track schema and applies grip / damage / collision effects when the player overlaps a hazard zone. §9 lists six hazard kinds. The damage-model and weather dots cover the underlying state machines; this dot owns the segment-overlap detector and per-kind effect dispatch. Currently no dot owns this runtime.

## Context

`docs/gdd/09-track-design.md` Hazards section enumerates: traffic cones and construction markers, signs and breakable clutter, puddles and slick paint, loose gravel bands, snow buildup, tunnel light adaptation. The §22 Track schema's per-segment `hazards: HazardId[]` array references hazard ids; this dot owns the registry and the runtime evaluator.

§13 damage sources include "off-road impacts with hard scenery", which maps onto cone / sign collisions. §23 damage formula targets gives `offRoadObjectDamage = 10 to 20`, which this dot consumes as the cone / sign hit magnitude band.

`implement-off-road-2f037c64` ships dust particles for off-road; this dot is distinct because hazards live in-lane (a puddle in your line) and trigger effects independent of the off-road flag.

Tunnel hazards are owned by their own dot (`implement-tunnel-segments-...`); this dot handles the in-lane physical hazards only.

## Affected Files

- `src/game/hazards.ts` (new): pure functions. `Hazard = {id, kind, segmentIndex, laneOffset, width, length}`. `evaluateHazards(carState, segment) => HazardEvent[]`. Per-kind effect: `applyHazardEffect(state, event) => {damage?, gripMultiplier?, speedDelta?}`. No I/O.
- `src/game/__tests__/hazards.test.ts` (new): cell-level fixtures for each kind. Pure determinism.
- `src/data/hazards.json` (new): hazard registry. Each entry: `{id, kind, defaultWidth, defaultLength, gripMultiplier?, damageBand?, breakable?}`.
- `src/data/schemas.ts` (update): `HazardKindSchema = z.enum(["puddle", "slick_paint", "cone", "sign", "gravel_band", "snow_buildup"])`. Tighten `Track.segments[].hazards` to validate against the registry.
- `src/data/__tests__/hazards-content.test.ts` (new): every entry validates; ids referenced by `src/data/tracks/**/*.json` exist in the registry.
- `src/game/raceSession.ts` (update): on each tick, call `evaluateHazards` per active segment around the player; dispatch effects to physics, damage, weather modules.

## Pinned hazard kind effects (placeholders for balancing-pass)

```ts
const HAZARD_EFFECTS: Record<HazardKind, HazardEffect> = {
  // Slick reduces grip; no damage.
  puddle:        { gripMultiplier: 0.65, damageBand: null, breakable: false },
  slick_paint:   { gripMultiplier: 0.80, damageBand: null, breakable: false },
  // Hard objects: collision damage; breakable cones flatten with no further hits.
  cone:          { gripMultiplier: 1.0,  damageBand: [4, 8],  breakable: true  }, // §23 lower band
  sign:          { gripMultiplier: 1.0,  damageBand: [10, 16], breakable: true },
  // Loose surface: grip + slow drag.
  gravel_band:   { gripMultiplier: 0.55, damageBand: [2, 4], breakable: false }, // rub-tier accumulation
  // Snow buildup: grip + heavy speed clamp.
  snow_buildup:  { gripMultiplier: 0.45, damageBand: null, breakable: false },
};
```

## Edge Cases

- Player drives through a broken cone: subsequent overlap events are no-ops; broken-state is per-race transient (not persisted).
- Hazard wider than lane: still evaluated against player x-offset; treated as "always-overlap" for that lane.
- Multiple hazards on same segment: events are independent; effects compose by multiplying grip, summing damage.
- Wet weather + puddle: per §14 rain reduces base grip and per this dot puddle reduces multiplier; effects multiply (rain * puddle) so the wet-tire choice matters more.
- DNF: hazards still evaluate cosmetically (so VFX still plays) but damage events are gated on `state.status === "racing"`.
- Determinism: damage band collapses to mid-range or seeds from the §22 RNG (`seeded-deterministic-2ae383f2`); never `Math.random`.

## Verify

- [ ] `evaluateHazards` for a segment with one cone in lane 1, player in lane 1 at the cone's segmentIndex returns one `HazardEvent` with kind "cone".
- [ ] Player in lane 0 returns zero events for the same fixture.
- [ ] Puddle effect: `applyHazardEffect(state, puddleEvent)` returns `gripMultiplier: 0.65`, no damage.
- [ ] Cone effect: returns damage event with magnitude in `[4, 8]` (mid-range collapse to 6 in deterministic mode).
- [ ] Breakable: a second pass over the same cone (broken-set tracked in race state) returns no event.
- [ ] Composition: rain + puddle multiplies grip multipliers (e.g. base * 0.88 * 0.65).
- [ ] Schema validation: `HazardKindSchema` rejects unknown ids; track JSONs that reference unknown hazards fail content tests.
- [ ] Pure: no Math.random, no Date.now (until rng module ships, in which case seeded).
- [ ] Race session integration: a fixture race that runs over a cone produces exactly one damage event in the race-state log.
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/game/hazards.ts src/data/hazards.json` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/09-track-design.md` Hazards
- `docs/gdd/13-damage-repairs-and-risk.md` Damage sources
- `docs/gdd/23-balancing-tables.md` Damage formula targets
- `docs/gdd/22-data-schemas.md` Track JSON schema (segments[].hazards)
