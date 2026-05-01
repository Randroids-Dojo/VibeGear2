# Pickup Design Contract

Date: 2026-05-01

This document pins the v1 pickup contract before runtime, rendering, audio,
and balance slices build on it.

## Goals

- Add a visible reason to choose a line beyond steering cleanly.
- Create small mid-race reward moments without adding fuel pressure.
- Preserve deterministic races, time trials, and ghost replay behavior.
- Keep cash pickups supplemental to finish rewards, sponsor goals, and tour
  progression.

## V1 Pickup Kinds

| Kind | Runtime effect | Standard value | Balance target |
| --- | --- | --- | --- |
| `cash` | Adds race cash paid with the final result | 50 to 200 credits | 5 to 15 percent of expected race cash |
| `nitro` | Tops up nitro reserve | 25 percent | One extra recovery or overtake chance |

## Authoring Contract

Pickups are authored in `Track.segments[].pickups`.

Each pickup has:

- `id`: unique within the track.
- `kind`: `cash` or `nitro`.
- `laneOffset`: normalized lateral placement from `-1` to `1`.
- `value`: credits for cash, reserve percent for nitro.

Runtime slices should treat segment-authored pickups like an inverse hazard:
use the same segment lookup and lateral overlap shape, but grant a benefit
instead of a penalty.

## Respawn And Reset Rules

- Pickups respawn each lap.
- Pickup collection resets on race start and race retry.
- Practice mode uses the same reset rule for v1.
- Ghost replay state must include collection state so playback remains
  byte-identical.

## AI Rule

AI ignores pickups in v1. This keeps AI pathing stable and avoids a hidden
catch-up rule. A later AI slice can add pickup awareness after the player
mechanic is readable.

## Sample Content

The schema slice seeds two test surfaces:

- `test/straight`: one centerline cash pickup and one right-lane nitro pickup
  for deterministic E2E and unit tests.
- `velvet-coast/harbor-run`: one launch cash pickup and one uphill nitro pickup
  for early race feel tuning.

## Next Slices

1. Runtime collection: `src/game/pickups.ts`, race-session state, cash delta,
   nitro reserve top-up, and deterministic tests.
2. Rendering and feedback: pickup sprites, collection burst, HUD flash, and
   Playwright coverage.
3. Audio: cash and nitro pickup SFX routed through existing race event audio.
