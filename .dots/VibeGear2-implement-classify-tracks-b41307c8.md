---
title: "implement: classify tracks by archetype and document lap target metadata"
status: open
priority: 2
issue-type: task
created-at: "2026-05-05T23:13:24.863360-05:00"
---

## Description

Add an `archetype` field to the authored `Track` schema with the four §7
buckets and label every production track in `src/data/tracks/*.json`.
This is the foundation slice for the lap-bump pass: it gives the
content team a single label per track so the §7 lap targets become
mechanically derivable.

Allowed values, exactly as named in `docs/gdd/07-race-rules-and-structure.md`
"Number of laps":

- `short-sprint`
- `standard`
- `long-scenic`
- `endurance`

## Context

`docs/gdd/07-race-rules-and-structure.md` pins lap counts per track
archetype (4-5 / 3 / 2 / 2-3). The 32 production tracks under
`src/data/tracks/*.json` do not currently carry an archetype label, so
the §7 mapping is implicit. This slice makes the mapping explicit so a
later slice can bump `laps` mechanically and so future authoring tools
can validate the §9 archetype-shaped anatomy (opening straight, one
signature feature, etc).

Q-013 in `docs/OPEN_QUESTIONS.md` records the recommended per-track
mapping and is the source of truth for the labels this slice writes.

## Affected files

- `src/data/schemas.ts` - add the `archetype` enum to `TrackSchema`.
  Make the field required for newly authored tracks; community tracks
  that omit it should default to `standard` so the lint is non-blocking
  for mods.
- `src/data/tracks/*.json` - add `"archetype": "<bucket>"` to every
  one of the 32 production track JSONs (excluding the three
  `test-*` tracks). Use the Q-013 recommended-default mapping.
- `src/data/__tests__/schemas.test.ts` - extend the existing track
  schema test to assert archetype validation: rejects unknown values,
  accepts the four allowed values, defaults to `standard` when omitted.

## Implementation notes

- Do not bump `laps` in this slice. That is the next slice
  (`VibeGear2-implement-bump-prod-076ae7e7`).
- Mod-loaded tracks must still parse if they omit `archetype`. The
  schema migration here is "add a defaulted optional field", not "add
  a required field". This keeps F-077 / F-070 era external-track URLs
  loading.
- The `_benchmark` tracks under `src/data/tracks/_benchmark/` and the
  `test-*.json` tracks should also default to `standard` so the
  regression suite does not have to change.
- Append a build-log entry to `docs/gdd/09-track-design.md` (the
  archetype field belongs to track design, not race rules).

## Verify

- [ ] `npm run typecheck` green.
- [ ] `npm run test` green; new tests cover archetype enum.
- [ ] `npm run content-lint` green; every production track parses with
      its archetype label.
- [ ] `npm run lint` green.
- [ ] All 32 production track JSONs carry an explicit `archetype` field.
      Verify with `for f in src/data/tracks/*.json; do grep -L
      '"archetype":' "$f"; done` returning only the `test-*` files
      and the `_benchmark` directory entries.
- [ ] `docs/gdd/09-track-design.md` build log has a new entry naming the
      schema change and the archetype enum.
- [ ] No track JSON outside `src/data/tracks/` was modified.

## Implementation Notes (iter-7 pre-flight)

### Track-class table (per Q-013 recommended default)

The 32 production track JSONs map to the four §7 archetypes as below.
This table is a copy-paste source for the slice. The mapping is
derived from §8 tour role + §9 length targets per Q-013; a one-line
edit per JSON suffices.

The slice does NOT bump `laps` (that lives in
`VibeGear2-implement-bump-prod-076ae7e7`); it only adds the
`"archetype": "<bucket>"` field.

#### Tier 1: Onboarding tour (Velvet Coast) - all `standard` (3 laps)

| File                                            | Tour                | Length |
| --                                              | --                  | --     |
| `velvet-coast-harbor-run.json`                  | Velvet Coast        | 1500 m |
| `velvet-coast-sunpier-loop.json`                | Velvet Coast        | 1536 m |
| `velvet-coast-cliffline-arc.json`               | Velvet Coast        | 1560 m |
| `velvet-coast-lighthouse-fall.json`             | Velvet Coast        | 1584 m |

#### Tier 2: Mid-game tours - mix per §8 role and §9 length

| File                                            | Tour                | Length | archetype     |
| --                                              | --                  | --     | --            |
| `iron-borough-foundry-mile.json`                | Iron Borough        | 1608 m | short-sprint  |
| `iron-borough-outer-exchange.json`              | Iron Borough        | 1620 m | short-sprint  |
| `iron-borough-freightline-ring.json`            | Iron Borough        | 1644 m | short-sprint  |
| `iron-borough-rivet-tunnel.json`                | Iron Borough        | 1668 m | short-sprint  |
| `ember-steppe-redglass-straight.json`           | Ember Steppe        | 1740 m | standard      |
| `ember-steppe-cinder-gate.json`                 | Ember Steppe        | 1800 m | standard      |
| `ember-steppe-mesa-coil.json`                   | Ember Steppe        | 1860 m | standard      |
| `ember-steppe-dustbreak-causeway.json`          | Ember Steppe        | 1920 m | standard      |
| `breakwater-isles-tidewire.json`                | Breakwater Isles    | 1880 m | standard      |
| `breakwater-isles-gull-point.json`              | Breakwater Isles    | 1960 m | standard      |
| `breakwater-isles-storm-span.json`              | Breakwater Isles    | 2040 m | standard      |
| `breakwater-isles-sealight-shelf.json`          | Breakwater Isles    | 2120 m | standard      |

#### Tier 3: Late-game tours - long-scenic (2 laps), mix on Glass Ridge

| File                                            | Tour                | Length | archetype     |
| --                                              | --                  | --     | --            |
| `glass-ridge-whitepass.json`                    | Glass Ridge         | -      | standard      |
| `glass-ridge-frostrelay.json`                   | Glass Ridge         | -      | standard      |
| `glass-ridge-hollow-crest.json`                 | Glass Ridge         | -      | long-scenic   |
| `glass-ridge-summit-echo.json`                  | Glass Ridge         | -      | long-scenic   |
| `neon-meridian-arc-boulevard.json`              | Neon Meridian       | -      | standard      |
| `neon-meridian-skyline-drain.json`              | Neon Meridian       | -      | standard      |
| `neon-meridian-prism-cut.json`                  | Neon Meridian       | -      | standard      |
| `neon-meridian-afterglow-run.json`              | Neon Meridian       | -      | standard      |
| `moss-frontier-millstream.json`                 | Moss Frontier       | 1980 m | long-scenic   |
| `moss-frontier-mistbarrow.json`                 | Moss Frontier       | 2080 m | long-scenic   |
| `moss-frontier-pine-switchback.json`            | Moss Frontier       | 2200 m | long-scenic   |
| `moss-frontier-wetroot-drive.json`              | Moss Frontier       | 2320 m | long-scenic   |

#### Tier 4: Endgame tour (Crown Circuit) - all `endurance` (2-3 laps)

| File                                            | Tour                | Length |
| --                                              | --                  | --     |
| `crown-circuit-embassy-loop.json`               | Crown Circuit       | 2240 m |
| `crown-circuit-grand-meridian.json`             | Crown Circuit       | 2360 m |
| `crown-circuit-victory-causeway.json`           | Crown Circuit       | 2480 m |
| `crown-circuit-final-horizon.json`              | Crown Circuit       | 2600 m |

#### Totals

- 4 short-sprint (4-5 laps)
- 16 standard (3 laps)
- 8 long-scenic (2 laps)
- 4 endurance (2-3 laps)

This matches Q-013 exactly. The lap-bump slice (`bump-prod-076ae7e7`)
will read each file's `archetype` field and set `laps` per the §7
default. A future hand-curation pass can flip an archetype on a
single JSON without re-running the bump slice.

### Schema delta (one-shot copy)

In `src/data/schemas.ts` `TrackSchema`, add:

    archetype: z.enum(["short-sprint", "standard", "long-scenic", "endurance"])
      .default("standard"),

The `default("standard")` is critical for backward compatibility per the
dot Implementation Notes above. Mod tracks and `_benchmark/test-*`
tracks omit the field and parse as `standard`.

### Q-NNN sweep (iter-7 confirmation)

Q-013 recommended default stands verbatim. The 4/16/8/4 split is
internally consistent and produces 2-5 minute race windows once the
lap-bump slice ships (per the §9 lap-time targets of 50-150 s per
lap). No tightening needed.
