---
title: "implement: seeded deterministic RNG module (per-race, per-system) for AI/damage/weather/ghost determinism"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:09:13.766032-05:00\\\"\""
closed-at: "2026-04-26T06:58:33.294544-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-full-ai-fab57b84
  - VibeGear2-implement-damage-model-765f2bb9
  - VibeGear2-implement-weather-38d61fc2
  - VibeGear2-implement-ghost-replay-7ea6ffaa
  - VibeGear2-implement-physics-feel-465d0cb6
---

## Description

Add `src/game/rng.ts`: a tiny, dependency-free, deterministic pseudo-random
number generator (PRNG) with per-race seeding and per-system sub-streams.
Production code that needs randomness (AI chaotic-archetype branch, damage hit
distribution, weather rolls, particle effects, ghost replay sanity) imports
from this module. `Math.random()` is banned in `src/game/` and `src/render/`
particle code by an ESLint custom rule added in this slice.

## Context

Several existing implement dots already pin determinism contracts:

- `implement-full-ai-fab57b84` line 41: chaotic archetype must use a "seeded
  PRNG threaded through race state" and forbids `Math.random`.
- `implement-damage-model-765f2bb9` line 38: damage state transitions must be
  deterministic; `applyHit` is forbidden from calling `Math.random`.
- `implement-ghost-replay-7ea6ffaa` and `implement-physics-feel-465d0cb6`
  rely on bit-exact replay of a recorded input stream, which is impossible if
  any sim-tick branch uses non-deterministic randomness.
- `docs/gdd/15-cpu-opponents-and-ai.md` (line 81) and
  `docs/gdd/21-technical-design-for-web-implementation.md` ("Deterministic
  inputs", "Deterministic replay tests") both name determinism as the
  contract. Neither GDD section names a specific PRNG.

Without a single owned RNG module, three concurrent dots would hand-roll their
own (or worse, smuggle `Math.random` in through a downstream library). The RNG
slice ships first so the AI / damage / weather / ghost slices can import a
common API and the linter can enforce the ban.

The PRNG is a 32-bit `mulberry32` (15 lines, public domain), chosen because:

1. Single-state-word (`u32`), trivially serializable into a save / replay.
2. Uniform output across `[0, 1)` after the standard `>>> 0 / 2**32` step.
3. Deterministic across V8 versions and browser engines (pure integer math; no
   IEEE-754 ordering hazard).
4. Fast enough for a 60 Hz sim with several rolls per tick.
5. Period 2^32 is short for crypto but more than ample for a 60 Hz race that
   never exceeds 10^5 ticks.

## Affected Files

- `src/game/rng.ts` (new):
  - `type Rng = { state: number; next: () => number; nextInt: (min, maxExclusive) => number; nextBool: (probability) => boolean; }`.
  - `createRng(seed: number): Rng` constructs a fresh PRNG from a 32-bit
    integer seed (uses Math.imul; never coerces NaN; rejects non-integer seeds
    with a clear error in dev, silently floors in prod).
  - `splitRng(parent: Rng, label: string): Rng` derives a deterministic
    sub-stream so AI / damage / weather can each have an independent stream
    that never advances the parent (label is hashed via FNV-1a).
  - `serializeRng(rng) -> number` and `deserializeRng(state: number) -> Rng`
    for replay save / restore.
- `src/game/__tests__/rng.test.ts` (new): determinism test (1000 calls
  reproduce the same sequence across two `createRng(42)` instances), splitRng
  isolation (parent stream unchanged after sub-stream advances), uniformity
  smoke (chi-square over 100k rolls within a generous tolerance), serialize
  round-trip, label collisions handled (FNV-1a over different labels yields
  different sub-streams; same labels yield same sub-stream).
- `src/game/index.ts` (modify): re-export Rng types and helpers.
- `.eslintrc.json` (modify): add a project-local `no-restricted-syntax` rule
  banning `Math.random()` calls in `src/game/` and `src/render/particle*` (or
  `src/render/effects*` once the visual-polish slice creates that path); the
  banned-call message points at `src/game/rng.ts`.
- `src/game/__tests__/no-math-random.test.ts` (new): a static guard that reads
  the `src/game/` tree and asserts no file other than `src/game/rng.ts` itself
  contains the literal `Math.random` token. Runs in CI alongside the lint
  rule; belt-and-braces for environments where ESLint config is bypassed.

## How callers use it

- `src/game/race.ts` (or wherever race state lives once `implement-race-rules`
  lands) constructs `const raceRng = createRng(race.seed);` from a 32-bit seed
  recorded on the race start event.
- AI uses `const aiRng = splitRng(raceRng, "ai");`.
- Damage uses `splitRng(raceRng, "damage")`.
- Weather uses `splitRng(raceRng, "weather")`.
- Ghost replay records the seed in the replay header; on playback the same
  `createRng(seed)` reproduces every chaotic branch byte-for-byte.

## Edge Cases

- Seed 0: must produce a non-degenerate sequence. `mulberry32` produces a
  fine-but-different sequence for 0; document and test that 0 is a valid seed
  and the first three outputs are pinned in a snapshot.
- Negative seed: coerce to `seed >>> 0` (unsigned 32-bit). Test pins.
- Float seed: dev mode throws with a helpful message; prod floors silently.
  Race code must always pass an int (we control the call site).
- `splitRng(parent, "")`: empty label is a programmer error; dev throws, prod
  uses a fixed sentinel sub-stream and warns once.
- `splitRng(parent, label)` consumes one parent state byte to derive the child
  seed. Document this so a caller never re-splits the same parent twice with
  the same label expecting independence (the second split returns a deeper
  child, not a sibling).
- Concurrency: PRNGs are not thread-safe; web sim is single-threaded, but the
  doc must call this out so a future Web Worker AI slice does not cross
  streams.
- Browser hot-reload: HMR must not silently re-create the RNG mid-race. The
  race tick file should hold the RNG in a stable state container; document
  the expectation here, enforce in the race-rules slice.

## Verify

- [ ] `createRng(42)` matches a published `mulberry32(42)` reference output
      for the first 8 calls (snapshot test pins the values).
- [ ] Two independent `createRng(42)` instances produce the same first 1000
      values (deep equal).
- [ ] `splitRng(parent, "ai")` produces a stream independent of
      `splitRng(parent, "damage")` (no overlap in first 1000 outputs is too
      strict; assert byte streams are not deep-equal and the FNV labels are
      distinct).
- [ ] `serializeRng -> deserializeRng` round-trips byte-exactly across 1000
      advances.
- [ ] `npm run lint` flags any new `Math.random()` call inside `src/game/`.
- [ ] Static guard test (`no-math-random.test.ts`) passes.
- [ ] `npm run typecheck` clean; `Rng` type re-exported from
      `src/game/index.ts`.
- [ ] No em-dashes (U+2014) or en-dashes (U+2013) in any added file (`grep -rP "[\x{2013}\x{2014}]" src/game/rng.ts src/game/__tests__/rng.test.ts src/game/__tests__/no-math-random.test.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/15-cpu-opponents-and-ai.md` (deterministic AI contract).
- `docs/gdd/21-technical-design-for-web-implementation.md` ("Deterministic
  inputs", "Deterministic replay tests").
- mulberry32 reference: Tommy Ettinger, public-domain, widely transcribed.
  Implementation must be a fresh re-write under MIT (no copy-paste from any
  source whose licence is unclear); the algorithm itself is unpatented.
- `.dots/VibeGear2-implement-full-ai-fab57b84.md` line 41.
- `.dots/VibeGear2-implement-damage-model-765f2bb9.md` line 38.
- `.dots/VibeGear2-implement-ghost-replay-7ea6ffaa.md`.
- `.dots/VibeGear2-implement-physics-feel-465d0cb6.md`.
