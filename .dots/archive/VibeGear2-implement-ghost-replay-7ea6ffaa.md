---
title: "implement: ghost replay (deterministic recording + playback)"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:45.936085-05:00\\\"\""
closed-at: "2026-04-26T07:07:49.082399-05:00"
close-reason: verified
---

## Description

Build `src/game/ghost.ts`. Record per-tick `Input` of the player during a Time Trial run; on playback, drive a translucent ghost car using the recorded inputs through the same physics. Determinism across record / playback is mandatory.

## Context

Phase 5 task per `docs/IMPLEMENTATION_PLAN.md`. The ghost / replay system is referenced by `docs/gdd/21-technical-design-for-web-implementation.md`. Replay tests are listed under §testing approach.

## Affected Files

- `src/game/ghost.ts` (new): `record(input, tick)`, `playback(replay) -> Iterator<Input>`
- `src/game/__tests__/ghost.test.ts` (new): record + playback produces identical car path within float tolerance
- `src/persistence/save.ts` (update): store best-ghost replay per track
- `src/render/pseudoRoadCanvas.ts` (update): render translucent ghost car

## Edge Cases

- Replay shorter than current run: ghost finishes; player sees no ghost after that point.
- Replay from older physics version: validate version stamp; if mismatched, ignore replay (with log).
- Storage size: cap recorded ticks; warn at 5000-tick threshold.

## Verify

- [ ] Unit tests confirm record + playback determinism within tolerance.
- [ ] Manual: run Time Trial, see your ghost on the next attempt.
- [ ] Replay version mismatch is handled cleanly.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## Spec stress-test (iteration 15, researcher pass)

This dot is the thinnest of the ready set. The Description names the module and the high-level contract; the verify list has only 5 bullets and three are vague ("confirm determinism within tolerance" without a tolerance, "handled cleanly" without a contract). An implementer would have to invent the file format, the storage shape, the version stamp, the comparison rule, and the integration points.

Concrete decisions to add to this dot:

1. **Replay file format must be pinned.** The dot says `record(input, tick)` and `playback(replay) -> Iterator<Input>` but never names the on-disk shape. Pin:
   ```ts
   export interface Replay {
     version: 1;                    // increments when the format changes
     physicsVersion: number;        // separate from format; bumped when physics math changes
     trackId: string;               // slug
     trackVersion: number;          // §22 Track.version
     carId: string;                 // slug; the recorded driver's car
     carUpgradesHash: string;       // FNV-1a over installed upgrades; ghost cannot replay if upgrades change
     seed: number;                  // u32 race seed (feeds the seeded-rng dot's createRng)
     fixedStepMs: number;           // pinned at FIXED_STEP_MS = 1000/60; replay rejects if loader's value differs
     totalTicks: number;
     finalTimeMs: number;           // bestLapMs equivalent; HUD reads this
     // Input deltas: only the bits that changed since the prior tick.
     // Layout: [tickIndex (u32), changedFieldsMask (u8), ...newValues].
     deltas: Uint8Array;            // serialised as base64 for JSON storage
   }
   ```
   Per-tick full input would be ~60 KB per minute of race (60 Hz * 60 s * ~17 bytes). Delta encoding cuts that by ~10x for typical races where inputs hold steady for many ticks.

2. **Determinism contract is unenforceable without the seeded RNG.** Add `blocks: VibeGear2-implement-seeded-deterministic-2ae383f2` to the front-matter. Replay determinism requires every randomness source (AI, weather, damage, particles) to read from a seeded PRNG; otherwise even a "no AI" Time Trial replay can drift if particle code calls `Math.random`. The seeded-rng dot already lists this dot in its `blocks:` list (line 11), so add the reverse pointer in `requires:` if the dot CLI supports it, or document in Context.

3. **`record(input, tick)` mutates state but the spec doesn't say which.** Pin a recorder shape:
   ```ts
   export interface Recorder {
     record(input: Input, tick: number): void;
     finalize(): Replay;       // closes the recording, computes finalTimeMs
   }
   export function createRecorder(opts: { trackId: string; carId: string; seed: number; ... }): Recorder;
   ```
   Same for playback:
   ```ts
   export interface Player {
     readNext(tick: number): Input | null;   // null means replay finished
     readonly finished: boolean;
   }
   export function createPlayer(replay: Replay): Player;
   ```
   This avoids the iterator-protocol question (sync vs async) and matches the rest of the codebase's "createX returns object with methods" pattern.

4. **"Replay shorter than current run: ghost finishes; player sees no ghost after that point."** Pin the playback frame after `finished === true`: returns the last recorded `Input` so the ghost car coasts to a stop under physics, OR returns `NEUTRAL_INPUT` so it lifts off. Recommend `NEUTRAL_INPUT` so a finished ghost does not mash throttle off the end of the recording.

5. **Storage cap is wrong.** "Cap recorded ticks; warn at 5000-tick threshold." 5000 ticks = 83 seconds at 60 Hz, less than one Time Trial lap on most tracks. Replace with: warn at `60 * 60 * 5 = 18000` ticks (5 min) and hard-cap at `60 * 60 * 15 = 54000` ticks (15 min), beyond which `finalize()` rejects. Document that endurance modes (post-v1.0) need a different recorder.

6. **Physics version stamp needs a source.** "Replay from older physics version: validate version stamp; if mismatched, ignore replay (with log)." But there is no `PHYSICS_VERSION` constant in `src/game/physics.ts`. Pin one:
   - Add `export const PHYSICS_VERSION = 1;` at the top of `physics.ts`, bump it any time the math changes (not just constants).
   - The build-version dot (`VibeGear2-implement-build-ver-c26ddc1f`) already covers git-SHA stamping; this is a separate logical version.
   - Add `src/game/physics.ts (update)` to Affected Files.

7. **`save.ts` storage shape is missing.** "Store best-ghost replay per track" — but `SaveGameSchema` (`src/data/schemas.ts`) does not have a `ghosts` field. Pin:
   ```ts
   // SaveSchema additions:
   ghosts: z.record(slug, GhostReplaySchema).optional(),
   // GhostReplaySchema mirrors Replay with the deltas stored as base64 string.
   ```
   This is a v3 migration of the save schema (assuming the audio-savegamesettings dot's v2 lands first). The `cross-tab-fa8cb14c` dot may also need updating to handle replay deltas in storage events. Add `blocks: VibeGear2-implement-savegamesettings-b948015a` for the migration framework.

8. **Comparison rule for "best ghost" is missing.** The dot says "store best-ghost replay per track" but does not say what "best" means. Pin: replace the stored ghost iff `newReplay.finalTimeMs < currentReplay.finalTimeMs`. Tied times keep the older ghost (no churn). Per-track, per-direction (forward / mirror) once mirror tracks land.

9. **Renderer integration is one bullet, needs three.**
   - `pseudoRoadCanvas.ts (update)` must accept a `ghostCar?: { z, x, alpha }` and draw it with `ctx.globalAlpha = 0.5`.
   - The car sprite for the ghost is the same atlas frame as the player (visual-polish slice) tinted blue or rendered desaturated.
   - The ghost car's `z` and `x` come from a separate physics step driven by `Player.readNext`; document that the race scene runs the ghost physics in the same `simulate` callback as the player.

10. **Determinism within tolerance is wrong.** "record + playback produces identical car path within float tolerance" — but with a seeded RNG and a pure physics step (which is the contract per AGENTS.md RULE 8), the result is **bit-exact**, not "within tolerance". Replace with `expect(playbackPath).toEqual(recordedPath)` (deep equal). If a tolerance is needed, the determinism contract is broken and the right fix is at the source.

11. **Affected Files miss the physics-feel benchmark dependency.** `physics-feel-465d0cb6` lists "ghost-replay regression test" in its title. That dot is the consumer; this dot is the producer. Make the dependency explicit: `physics-feel` blocks on `ghost-replay`.

12. **Test count realism.** Verify list has 5 bullets but a real test suite needs ~25 cases:
    - Recorder: per-tick record (5), delta encoding (4), finalize (3), cap warning + hard cap (3).
    - Player: read next (3), finished after replay end (2), corrupt deltas (2).
    - Round-trip: scripted physics inputs produce identical CarState at every tick (3 cases: straight, curve, off-road).
    - Version mismatch: format version + physics version + track version (3).
    - Save integration: best-ghost replacement, equal-time keeps old, missing-track key (3).

13. **Time Trial dependency.** The dot says "during a Time Trial run" but `time-trial-5d65280a` is not in the front-matter blocks. Add `blocks: VibeGear2-implement-time-trial-5d65280a` since recording is wired into the Time Trial UI ("save as PB" button per the time-trial dot).

14. **Playwright e2e is missing.** The dot lists no e2e test, but `e2e/ghost-replay.spec.ts` is the natural fit: load Time Trial, drive a lap, finish, restart, assert a ghost car renders within 100 ms of countdown end. Add it to Verify; defer to F-NNN if the harness still does not exist (mirrors F-016, F-017 deferral pattern).
