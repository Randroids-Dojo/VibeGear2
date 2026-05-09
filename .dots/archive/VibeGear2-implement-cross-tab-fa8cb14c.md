---
title: "implement: cross-tab save consistency + storage event sync per §21 §22"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:09:15.415124-05:00\\\"\""
closed-at: "2026-04-26T12:11:23.102704-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-garage-flow-07f26703
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Make `SaveGame` cross-tab safe. Two tabs of the deployed build can each load,
mutate, and persist the same save key; today the second writer silently
clobbers the first. Add a last-write-wins protocol with a monotonic write
counter, a `storage` event listener that hot-reloads the in-memory save when
another tab writes, and a focus / visibility-change check that re-reads the
save before any UI mutation.

## Context

`src/persistence/save.ts` currently writes a single key
(`vibegear2:save:v<N>`) on demand. The persistence module is well-shaped (see
`src/persistence/save.ts` lines 76 to 226) but has no notion of concurrent
writers. GDD §21 "Save system" calls for "versioned local save with optional
cloud sync later"; §22 SaveGame schema is the data shape; neither section
mentions cross-tab. Two real failure cases today:

1. **Two-tab credit drift.** Tab A buys an upgrade (credits 1000 -> 800). Tab
   B is on the title screen, holds the pre-purchase save in memory, then
   navigates to garage and saves a setting (`displaySpeedUnit`). Tab B's
   write restores credits to 1000. The player effectively got a free upgrade.
2. **Mid-write reload.** Tab A is mid-race when Tab B is opened; Tab B reads
   the save, sees the v2 shape, but Tab A's state has stale ownedCars in
   memory; on race exit Tab A writes its stale ownedCars back, undoing a
   purchase made in Tab B.

GDD §27 "risks and mitigations" does not currently name this risk; this
slice's PROGRESS_LOG entry adds a one-liner to §27 plus an OPEN_QUESTIONS
entry if the dev wants leader-tab election instead of last-write-wins
(default is last-write-wins because it is simplest and the data is local-only
in the MVP).

## Affected Files

- `src/persistence/save.ts` (modify):
  - Add a `writeCounter: number` to the persisted shape (separate from the
    schema `version`; `writeCounter` is per-write, monotonic, advisory only).
    Stored alongside the save inside the JSON payload, not as a separate
    key.
  - `saveSave()` increments `writeCounter` before serialize.
  - Add `subscribeToSaveChanges(callback: (next: SaveGame) => void): () =>
    void` that wires a `storage` event listener (filter on the save key
    prefix; ignore changes from the same tab; parse and validate before
    invoking the callback). Returns an unsubscribe.
  - Add `reloadIfNewer(currentInMemory: SaveGame): SaveGame | null` for
    page-focus / visibility re-checks; returns the on-disk save when its
    `writeCounter` exceeds the in-memory counter, else null.
- `src/persistence/migrations/v1ToV2.ts` (modify, if not already authored by
  the SaveGameSettings dot): add `writeCounter: 0` to migrated v2 saves.
  Coordinate with `implement-savegamesettings-b948015a` so this slice does
  not collide with its v2 migration.
- `src/persistence/save.test.ts` (modify): two-writer scenario:
  - Two `Storage` shims sharing a backing map; verify last write wins and
    `writeCounter` strictly increases.
  - `subscribeToSaveChanges` fires when a foreign tab writes; does not fire
    on same-tab writes.
  - `reloadIfNewer` returns null when in-memory writeCounter equals on-disk;
    returns the on-disk save when it is newer.
- `docs/gdd/21-technical-design-for-web-implementation.md` (modify): append
  a "Cross-tab consistency" subsection under "Save system" naming
  last-write-wins with `writeCounter` advisory and the focus-revalidate
  pattern. One paragraph. Cross-link this dot's PROGRESS_LOG entry.
- `docs/gdd/27-risks-and-mitigations.md` (modify): append a row "Cross-tab
  save corruption: last-write-wins + writeCounter + focus revalidate".
- `docs/OPEN_QUESTIONS.md` (modify): add `Q-NNN: should cross-tab use
  leader-election instead of last-write-wins?` with recommended default
  last-write-wins.

## Edge Cases

- `storage` event does not fire in the originating tab; this is the
  documented browser behaviour and the listener relies on it. Test asserts
  same-tab writes do not echo into the listener (use a shared mock that
  emits to all tabs and a per-tab tab-id filter).
- Private mode / `localStorage` unavailable: `subscribeToSaveChanges` is a
  no-op, returns an unsubscribe that is also a no-op. No throw.
- `writeCounter` overflow: at 60 saves per second a `Number.MAX_SAFE_INTEGER`
  is centuries away. Document and ignore.
- `writeCounter` missing in legacy payload: treat as `0`, allow the upgrade
  path; first write seeds it.
- Focus event during an active race: re-reading the save mid-race must NOT
  reset the live race state. The `reloadIfNewer` consumer is the garage /
  title screens only; `RaceState` is independent of `SaveGame` until the
  race ends. Document this in the race-rules slice's contract.
- The `BroadcastChannel` API is not used in this slice; `storage` event is
  enough and works in every supported browser including Safari. A future
  slice can add `BroadcastChannel` for in-app cross-tab coordination
  (pause-all-tabs, etc.) if §27 ever requires it.

## Verify

- [ ] Unit tests cover the three scenarios above (last-write-wins,
      subscribe filters same-tab, reloadIfNewer returns newer save).
- [ ] `defaultSave()` round-trips with `writeCounter: 0` initially.
- [ ] `npm run typecheck` clean; new exports surface from
      `src/persistence/index.ts`.
- [ ] `npm run lint` clean.
- [ ] No em-dashes (U+2014) or en-dashes (U+2013) in added or modified files (`grep -rP "[\x{2013}\x{2014}]"
      src/persistence/save.ts src/persistence/save.test.ts
      docs/gdd/21-technical-design-for-web-implementation.md
      docs/gdd/27-risks-and-mitigations.md` returns nothing).
- [ ] OPEN_QUESTIONS.md has `Q-NNN` entry on leader-election alternative.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6 noting the GDD
      edits.

## References

- `src/persistence/save.ts` (current behaviour).
- `docs/gdd/21-technical-design-for-web-implementation.md` "Save system".
- `docs/gdd/22-data-schemas.md` (SaveGame).
- `docs/gdd/27-risks-and-mitigations.md` (risk catalogue).
- `.dots/VibeGear2-implement-savegamesettings-b948015a.md` (coordinate v2
  migration so `writeCounter` is added in the same migration step).
