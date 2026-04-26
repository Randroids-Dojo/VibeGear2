/**
 * Seeded deterministic pseudo-random number generator (PRNG) per the
 * iter-30 stress-test on dot
 * `VibeGear2-implement-seeded-deterministic-2ae383f2`.
 *
 * Why a dedicated module? Several systems in the runtime core need
 * randomness:
 *
 *   - `ai.ts` chaotic archetype branches (`docs/gdd/15-cpu-opponents-and-ai.md`).
 *   - `damage.ts` hit / spin distributions
 *     (`docs/gdd/13-damage-and-repair-system.md`).
 *   - The future weather slice (`docs/gdd/14-environment-systems.md`).
 *   - Particle effects under `src/render/effects*` (visual-polish slice).
 *   - Ghost replay sanity checks in `src/game/ghost.ts` (planned).
 *
 * If each of these reaches for `Math.random()` independently, the §21
 * "Deterministic replay tests" contract is unenforceable: two runs from
 * the same seed will diverge the moment any of them rolls a die. Worse,
 * a stray particle-system call to `Math.random` invalidates a recorded
 * ghost without any visible warning.
 *
 * This module ships a single owned PRNG so every randomness consumer
 * imports from one place. The shape is small enough to serialise in a
 * 32-bit save slot and an ESLint guard (added in this same slice) bans
 * `Math.random()` everywhere except this file and its tests.
 *
 * Algorithm: `mulberry32`. A widely-transcribed public-domain 15-line
 * PRNG with these properties:
 *
 *   1. Single-state-word `u32`. Trivially serialisable.
 *   2. Uniform output across `[0, 1)` after the standard
 *      `>>> 0 / 2**32` step.
 *   3. Deterministic across V8 / SpiderMonkey / JavaScriptCore. No
 *      IEEE-754 ordering hazards because the entire core uses integer
 *      ops via `Math.imul`.
 *   4. Fast enough for a 60 Hz sim with several rolls per tick.
 *   5. Period 2^32 is cryptographically weak but more than ample for a
 *      60 Hz race that never exceeds ~10^5 ticks.
 *
 * The implementation is a fresh transcription of the algorithm; the
 * algorithm itself is unpatented and the source is public-domain.
 *
 * Determinism rules this module enforces:
 *
 *   - Same seed produces the same sequence across runs and engines.
 *   - `splitRng(parent, label)` derives an independent sub-stream by
 *     consuming exactly one parent state advance plus an FNV-1a hash of
 *     the label. The parent state is left at its post-consume value;
 *     callers that need the parent untouched should split a copy.
 *   - `serializeRng(rng)` and `deserializeRng(state)` round-trip
 *     byte-exactly.
 *   - Every `next` / `nextInt` / `nextBool` call advances the state by
 *     exactly one step. No call paths skip or batch advances.
 *
 * Concurrency: the PRNG is not thread-safe. The web sim is single-
 * threaded so this is moot today; a future Web Worker AI slice must
 * either pass a fresh `Rng` per worker or use a `MessageChannel` to
 * route rolls back to the main thread.
 */

// Type exports -----------------------------------------------------------

/**
 * A deterministic PRNG. The `state` field is the single u32 word the
 * algorithm advances; serialising / restoring this number reproduces
 * every future roll byte-for-byte. The methods are bound to the instance
 * so a caller can pass `rng.next` to a higher-order helper without
 * losing `this`.
 *
 * Method semantics:
 *
 *   - `next()`: returns a uniform float in `[0, 1)` and advances the
 *     state by one step.
 *   - `nextInt(min, maxExclusive)`: returns a uniform integer in
 *     `[min, maxExclusive)`. Throws when the range is empty or
 *     non-finite. Advances the state by one step.
 *   - `nextBool(probability)`: returns `true` with the given
 *     probability. `probability <= 0` always returns `false`;
 *     `probability >= 1` always returns `true`. Either edge still
 *     advances the state so the call is observable in a replay.
 */
export interface Rng {
  state: number;
  next: () => number;
  nextInt: (min: number, maxExclusive: number) => number;
  nextBool: (probability: number) => boolean;
}

// Public API -------------------------------------------------------------

/**
 * Build a fresh PRNG from a 32-bit integer seed.
 *
 * Seed normalisation:
 *
 *   - Negative seeds are coerced to `seed >>> 0` (unsigned 32-bit). This
 *     makes `-1` equivalent to `0xFFFFFFFF`, which is fine for a PRNG
 *     because the algorithm only cares about the bit pattern.
 *   - Float seeds are floored in production and throw in dev (process
 *     env or Vitest `expect.fail` style). Race code controls every
 *     call site; a float seed is a programmer error worth catching
 *     loudly during development.
 *   - `NaN` and non-finite seeds always throw because they cannot be
 *     coerced into a meaningful state without silently producing the
 *     all-zero stream.
 *
 * The algorithm allows seed `0` (the result is a valid sequence of its
 * own, just different from `1`). The dot stress-test calls this out as a
 * supported case; a snapshot test in `rng.test.ts` pins the first three
 * values for seed `0` so a future refactor cannot quietly change the
 * sequence.
 */
export function createRng(seed: number): Rng {
  const normalised = normaliseSeed(seed);
  return makeRng(normalised);
}

/**
 * Derive a deterministic sub-stream from a parent PRNG. The label is
 * hashed with FNV-1a and mixed with one parent advance to produce a
 * fresh seed for the child stream.
 *
 * Why mix the parent state in? Two different parents must produce
 * different children even when called with the same label. Hashing the
 * label alone would mean every race that called `splitRng(rng, "ai")`
 * got the same AI stream regardless of the race seed; mixing the parent
 * state in restores the dependency on the original seed.
 *
 * Side effect: this function consumes one parent state advance. A
 * caller that needs to derive multiple unrelated children from the same
 * conceptual point should snapshot the parent first:
 *
 *   const snapshot = serializeRng(parent);
 *   const aiRng = splitRng(parent, "ai");
 *   const damageRng = splitRng(deserializeRng(snapshot), "damage");
 *
 * This is the standard pattern documented in the dot stress-test §"How
 * callers use it" so race-rules construction can fan out three or four
 * sub-streams without the order of `splitRng` calls mattering.
 *
 * Empty labels throw in dev and use a fixed sentinel (`""`) hash in
 * prod so a buggy caller does not silently collide with another empty
 * label and re-roll the same numbers.
 */
export function splitRng(parent: Rng, label: string): Rng {
  if (typeof label !== "string") {
    throw new TypeError(`splitRng label must be a string, got ${typeof label}`);
  }
  if (label.length === 0 && process.env.NODE_ENV !== "production") {
    throw new Error(
      "splitRng label must be a non-empty string; use a stable subsystem name (e.g. 'ai')",
    );
  }
  const labelHash = fnv1a32(label);
  // Consume one parent advance so the caller cannot reseed the same
  // child twice and expect independence; both calls would derive from
  // the same `(parentState, label)` pair if the parent was not advanced.
  parent.next();
  // Mix the post-advance parent state with the label hash. `Math.imul`
  // keeps the multiply within u32 even on 64-bit JS engines; the final
  // `>>> 0` re-normalises the sum back into u32 land.
  const mixed = (Math.imul(parent.state, 0x9e3779b1) ^ labelHash) >>> 0;
  return makeRng(mixed === 0 ? 1 : mixed);
}

/**
 * Snapshot a PRNG's state for save / replay. Returns the single u32
 * word that, fed back into `deserializeRng`, reproduces every future
 * roll. Pure: does not advance the source PRNG.
 *
 * The return type is `number` (not a tagged opaque type) so a save-game
 * schema can store it as a plain integer without a serialiser shim. The
 * trade-off is that callers can pass any `number` to `deserializeRng`
 * without the type checker complaining; the runtime normalises the
 * input the same way `createRng` does, so a corrupted save still
 * produces a deterministic-but-wrong sequence rather than crashing.
 */
export function serializeRng(rng: Rng): number {
  return rng.state >>> 0;
}

/**
 * Reconstruct a PRNG from a previously serialised state. The input is
 * normalised the same way as `createRng`, so a save written under one
 * runtime version reads back identically under any other runtime
 * version that ships this module.
 *
 * The algorithm permits state `0`; we keep the same allowance here so a
 * round-trip of a freshly-created `createRng(0)` works as documented.
 */
export function deserializeRng(state: number): Rng {
  return makeRng(normaliseSeed(state));
}

// Implementation ---------------------------------------------------------

/**
 * Build the closure-bound PRNG instance. Kept private so the only entry
 * points are the documented `createRng` / `splitRng` / `deserializeRng`
 * functions; no caller can construct an `Rng` with a partial state by
 * mistake.
 */
function makeRng(initialState: number): Rng {
  // Closing over a mutable local rather than `this.state` keeps the
  // method bindings stable: a caller can `const next = rng.next` and
  // call it without losing the state reference. We then mirror the
  // closed-over value onto `rng.state` after every advance so
  // `serializeRng` reads the latest snapshot.
  let state = initialState >>> 0;

  const rng: Rng = {
    state,
    next: () => {
      state = advance(state);
      rng.state = state;
      return mulberry32Output(state);
    },
    nextInt: (min: number, maxExclusive: number) => {
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(maxExclusive) ||
        !Number.isInteger(min) ||
        !Number.isInteger(maxExclusive)
      ) {
        throw new RangeError(
          `nextInt requires integer bounds, got [${min}, ${maxExclusive})`,
        );
      }
      if (maxExclusive <= min) {
        throw new RangeError(
          `nextInt requires maxExclusive > min, got [${min}, ${maxExclusive})`,
        );
      }
      const range = maxExclusive - min;
      state = advance(state);
      rng.state = state;
      // Floor of (uniform [0,1) * range) is uniform across the integer
      // range when `range` divides 2^32 cleanly; for arbitrary ranges
      // there is a vanishingly small bias toward the low end (one part
      // in ~10^9 for ranges under 1000). Acceptable for game-side
      // randomness; cryptographic callers should use a different
      // primitive.
      return min + Math.floor(mulberry32Output(state) * range);
    },
    nextBool: (probability: number) => {
      // Always advance so the call is observable in a replay; this
      // keeps the per-tick PRNG usage count stable even when a guard
      // short-circuits the probability check above.
      state = advance(state);
      rng.state = state;
      if (!Number.isFinite(probability) || probability <= 0) return false;
      if (probability >= 1) return true;
      return mulberry32Output(state) < probability;
    },
  };
  return rng;
}

/**
 * One step of the mulberry32 algorithm. Pure 32-bit integer math via
 * `Math.imul`; the `>>> 0` after the addition keeps the result in u32
 * range across any JS engine. The constant `0x6D2B79F5` is the
 * canonical mulberry32 increment.
 */
function advance(state: number): number {
  return (state + 0x6d2b79f5) >>> 0;
}

/**
 * Convert a mulberry32 state word into a uniform float in `[0, 1)`. The
 * algorithm folds the state through three rounds of mix-and-shift to
 * decorrelate the output from the linear progression of the state.
 *
 * The final `/ 4294967296` (2^32) maps the u32 output to a float in
 * `[0, 1)`. Returning `1.0` is impossible because the dividend is
 * always strictly less than 2^32.
 */
function mulberry32Output(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Normalise a caller-supplied seed into a u32 state word. Mirrors the
 * documented behaviour of `createRng`:
 *
 *   - NaN, ±Infinity: throw, since there is no sane coercion.
 *   - Float in dev: throw with a helpful message.
 *   - Float in prod: floor silently, then normalise.
 *   - Negative integer: `seed >>> 0` (unsigned 32-bit).
 */
function normaliseSeed(seed: number): number {
  if (typeof seed !== "number" || Number.isNaN(seed) || !Number.isFinite(seed)) {
    throw new RangeError(
      `createRng requires a finite numeric seed, got ${String(seed)}`,
    );
  }
  if (!Number.isInteger(seed)) {
    if (process.env.NODE_ENV !== "production") {
      throw new RangeError(
        `createRng requires an integer seed; got ${seed}. Pass Math.floor(seed) explicitly to opt in.`,
      );
    }
    return Math.floor(seed) >>> 0;
  }
  return seed >>> 0;
}

/**
 * FNV-1a 32-bit hash. Used by `splitRng` to derive a u32 from a label
 * string. The constants `0x811c9dc5` (offset basis) and `0x01000193`
 * (FNV prime) are canonical FNV-1a-32. `Math.imul` keeps the multiply
 * within u32 across all JS engines.
 *
 * Pure: same input always yields the same output. Used internally so
 * the function is not exported; callers that need a string hash should
 * import their own implementation rather than coupling to this one.
 */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
