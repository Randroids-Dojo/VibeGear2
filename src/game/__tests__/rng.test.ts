/**
 * Unit tests for the deterministic PRNG in `src/game/rng.ts`.
 *
 * Coverage map:
 *
 *   - Reference snapshot: `createRng(42)` matches the canonical
 *     mulberry32(42) sequence for the first 8 calls. Pin so a future
 *     algorithmic refactor cannot quietly change the stream.
 *
 *   - Determinism: two `createRng(42)` instances produce the same first
 *     1000 values (deep equal).
 *
 *   - Seed normalisation: zero, negative, very large, and overflow seeds
 *     all produce the documented stream and never throw.
 *
 *   - Seed rejection: NaN, Infinity, and float seeds throw in dev mode.
 *
 *   - `splitRng` isolation: two children with different labels produce
 *     different streams; same parent + same label produces the same
 *     child; the parent is advanced by one step per `splitRng` call.
 *
 *   - `splitRng` empty label: rejected in dev.
 *
 *   - `serializeRng` / `deserializeRng`: round-trip after 1000 advances
 *     produces the same continued sequence.
 *
 *   - `nextInt` semantics: stays in `[min, maxExclusive)`, rejects bad
 *     ranges, accepts negative bounds.
 *
 *   - `nextBool` semantics: probability 0 always false, 1 always true,
 *     0.5 produces a fair-ish split over many rolls; the call still
 *     advances state at p=0 and p=1 (replay-observable).
 *
 *   - Frozen-input invariant: calling `next` does not mutate the state
 *     of an unrelated PRNG.
 */

import { describe, expect, it } from "vitest";

import {
  createRng,
  deserializeRng,
  serializeRng,
  splitRng,
} from "../rng";

describe("createRng reference snapshot", () => {
  it("matches the canonical mulberry32(42) sequence for the first 8 calls", () => {
    const rng = createRng(42);
    const expected = [
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
      0.6697340414393693, 0.17481389874592423, 0.5265925421845168,
      0.2732279943302274, 0.6247446539346129,
    ];
    const actual = expected.map(() => rng.next());
    expect(actual).toEqual(expected);
  });

  it("returns a non-degenerate sequence for seed 0", () => {
    const rng = createRng(0);
    const values = [rng.next(), rng.next(), rng.next()];
    expect(values).toEqual([
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
  });
});

describe("createRng determinism", () => {
  it("two independent createRng(42) instances produce the same first 1000 values", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 1000; i += 1) {
      seqA.push(a.next());
      seqB.push(b.next());
    }
    expect(seqA).toEqual(seqB);
  });

  it("each call returns a value in [0, 1)", () => {
    const rng = createRng(12345);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("createRng seed normalisation", () => {
  it("accepts seed 0", () => {
    expect(() => createRng(0)).not.toThrow();
  });

  it("coerces negative integer seeds to u32", () => {
    const a = createRng(-1);
    const b = createRng(0xffffffff);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("accepts max u32 seed", () => {
    expect(() => createRng(0xffffffff)).not.toThrow();
  });

  it("rejects NaN", () => {
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
  });

  it("rejects Infinity", () => {
    expect(() => createRng(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => createRng(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it("rejects float seeds in dev", () => {
    // Vitest defaults NODE_ENV to "test"; the dev-mode branch fires.
    expect(() => createRng(1.5)).toThrow(RangeError);
  });
});

describe("splitRng isolation", () => {
  it("different labels produce different streams from the same parent state", () => {
    const a = splitRng(createRng(42), "ai");
    const b = splitRng(createRng(42), "damage");
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      seqA.push(a.next());
      seqB.push(b.next());
    }
    expect(seqA).not.toEqual(seqB);
  });

  it("the same label on the same parent state produces the same child stream", () => {
    const a = splitRng(createRng(42), "ai");
    const b = splitRng(createRng(42), "ai");
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 16; i += 1) {
      seqA.push(a.next());
      seqB.push(b.next());
    }
    expect(seqA).toEqual(seqB);
  });

  it("advances the parent by one step per call", () => {
    const parent = createRng(42);
    const before = parent.state;
    splitRng(parent, "ai");
    expect(parent.state).not.toBe(before);
    // The parent's next value matches an unrelated rng that was
    // advanced once in lockstep, confirming the advance count is one.
    const lockstep = createRng(42);
    lockstep.next();
    expect(parent.state).toBe(lockstep.state);
  });

  it("rejects an empty label in dev", () => {
    const parent = createRng(42);
    expect(() => splitRng(parent, "")).toThrow(/non-empty/);
  });

  it("rejects a non-string label", () => {
    const parent = createRng(42);
    expect(() =>
      // Cast to satisfy the type checker; the runtime check is the test target.
      splitRng(parent, 123 as unknown as string),
    ).toThrow(TypeError);
  });

  it("different parent seeds with the same label produce different children", () => {
    const a = splitRng(createRng(1), "ai");
    const b = splitRng(createRng(2), "ai");
    expect([a.next(), a.next(), a.next()]).not.toEqual([
      b.next(),
      b.next(),
      b.next(),
    ]);
  });
});

describe("serializeRng / deserializeRng", () => {
  it("round-trips byte-exactly across 1000 advances", () => {
    const a = createRng(42);
    for (let i = 0; i < 1000; i += 1) a.next();
    const snapshot = serializeRng(a);
    const b = deserializeRng(snapshot);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      seqA.push(a.next());
      seqB.push(b.next());
    }
    expect(seqA).toEqual(seqB);
  });

  it("snapshot of a fresh rng can resume from the same point", () => {
    const a = createRng(7);
    const snapshot = serializeRng(a);
    const b = deserializeRng(snapshot);
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
    expect(a.next()).toBe(b.next());
  });

  it("normalises a corrupted state without throwing", () => {
    expect(() => deserializeRng(-1)).not.toThrow();
  });
});

describe("nextInt", () => {
  it("stays within [min, maxExclusive)", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.nextInt(0, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("supports negative bounds", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.nextInt(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it("rejects empty ranges", () => {
    const rng = createRng(99);
    expect(() => rng.nextInt(5, 5)).toThrow(RangeError);
    expect(() => rng.nextInt(5, 4)).toThrow(RangeError);
  });

  it("rejects non-integer bounds", () => {
    const rng = createRng(99);
    expect(() => rng.nextInt(0.5, 10)).toThrow(RangeError);
    expect(() => rng.nextInt(0, 10.5)).toThrow(RangeError);
    expect(() => rng.nextInt(Number.NaN, 10)).toThrow(RangeError);
    expect(() => rng.nextInt(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("is deterministic across runs with the same seed", () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA: number[] = [];
    const seqB: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      seqA.push(a.nextInt(0, 1000));
      seqB.push(b.nextInt(0, 1000));
    }
    expect(seqA).toEqual(seqB);
  });
});

describe("nextBool", () => {
  it("returns false for probability 0", () => {
    const rng = createRng(99);
    for (let i = 0; i < 100; i += 1) {
      expect(rng.nextBool(0)).toBe(false);
    }
  });

  it("returns true for probability 1", () => {
    const rng = createRng(99);
    for (let i = 0; i < 100; i += 1) {
      expect(rng.nextBool(1)).toBe(true);
    }
  });

  it("advances state even at p=0 and p=1 (replay-observable)", () => {
    const rngZero = createRng(42);
    const rngOne = createRng(42);
    const lockstep = createRng(42);
    rngZero.nextBool(0);
    rngOne.nextBool(1);
    lockstep.next();
    expect(rngZero.state).toBe(lockstep.state);
    expect(rngOne.state).toBe(lockstep.state);
  });

  it("produces a roughly fair split for p=0.5 over 10000 rolls", () => {
    const rng = createRng(42);
    let trues = 0;
    const trials = 10_000;
    for (let i = 0; i < trials; i += 1) {
      if (rng.nextBool(0.5)) trues += 1;
    }
    // Generous tolerance: 10% of trials. A fair coin lands inside this
    // band with overwhelming probability for n=10000.
    const ratio = trues / trials;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it("rejects NaN probability silently (treats as false)", () => {
    const rng = createRng(42);
    expect(rng.nextBool(Number.NaN)).toBe(false);
  });

  it("is deterministic across runs", () => {
    const a = createRng(7);
    const b = createRng(7);
    const seqA: boolean[] = [];
    const seqB: boolean[] = [];
    for (let i = 0; i < 100; i += 1) {
      seqA.push(a.nextBool(0.3));
      seqB.push(b.nextBool(0.3));
    }
    expect(seqA).toEqual(seqB);
  });
});

describe("isolation invariants", () => {
  it("calling next on one PRNG does not mutate another with the same initial seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    a.next();
    a.next();
    a.next();
    // b is still at its starting state.
    const lockstep = createRng(42);
    expect(b.state).toBe(lockstep.state);
  });

  it("methods can be destructured without losing state", () => {
    const rng = createRng(42);
    const { next } = rng;
    const direct = createRng(42);
    expect(next()).toBe(direct.next());
    expect(next()).toBe(direct.next());
  });
});
