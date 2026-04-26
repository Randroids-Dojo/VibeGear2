import { describe, expect, it } from "vitest";

import {
  applyProgress,
  EMPTY_SNAPSHOT,
  formatLoadingText,
  progressFraction,
  startLoading,
  type ProgressEvent,
} from "../loadingState";

const MANIFEST_ID = "test-manifest";

function progress(overrides: Partial<ProgressEvent> = {}): ProgressEvent {
  return {
    manifestId: MANIFEST_ID,
    total: 4,
    completed: 1,
    failed: 0,
    outcome: "success",
    entryId: "a",
    critical: true,
    ...overrides,
  };
}

describe("startLoading", () => {
  it("returns idle when total is 0", () => {
    const snap = startLoading(MANIFEST_ID, 0);
    expect(snap.phase).toBe("idle");
    expect(snap.total).toBe(0);
  });

  it("starts in loading state when total > 0", () => {
    const snap = startLoading(MANIFEST_ID, 6);
    expect(snap.phase).toBe("loading");
    expect(snap.total).toBe(6);
    expect(snap.completed).toBe(0);
    expect(snap.failed).toBe(0);
    expect(snap.warnings).toEqual([]);
    expect(snap.criticalFailures).toEqual([]);
  });
});

describe("applyProgress", () => {
  it("transitions from loading to ready once every entry settles", () => {
    let snap = startLoading(MANIFEST_ID, 3);
    snap = applyProgress(snap, progress({ total: 3, completed: 1, entryId: "a" }));
    expect(snap.phase).toBe("loading");
    snap = applyProgress(snap, progress({ total: 3, completed: 2, entryId: "b" }));
    expect(snap.phase).toBe("loading");
    snap = applyProgress(snap, progress({ total: 3, completed: 3, entryId: "c" }));
    expect(snap.phase).toBe("ready");
  });

  it("collects non-critical failures as warnings without blocking", () => {
    let snap = startLoading(MANIFEST_ID, 2);
    snap = applyProgress(
      snap,
      progress({
        total: 2,
        completed: 0,
        failed: 1,
        outcome: "failure",
        entryId: "warn-1",
        critical: false,
      }),
    );
    expect(snap.warnings).toEqual(["warn-1"]);
    expect(snap.criticalFailures).toEqual([]);
    expect(snap.phase).toBe("loading");
    snap = applyProgress(
      snap,
      progress({
        total: 2,
        completed: 1,
        failed: 1,
        outcome: "success",
        entryId: "ok",
      }),
    );
    expect(snap.phase).toBe("ready");
    expect(snap.warnings).toEqual(["warn-1"]);
  });

  it("transitions to failed-critical the moment a critical entry fails", () => {
    let snap = startLoading(MANIFEST_ID, 3);
    snap = applyProgress(snap, progress({ total: 3, completed: 1 }));
    snap = applyProgress(
      snap,
      progress({
        total: 3,
        completed: 1,
        failed: 1,
        outcome: "failure",
        entryId: "broken",
        critical: true,
      }),
    );
    expect(snap.phase).toBe("failed-critical");
    expect(snap.criticalFailures).toEqual(["broken"]);
  });

  it("stays in failed-critical even after all entries settle", () => {
    let snap = startLoading(MANIFEST_ID, 2);
    snap = applyProgress(
      snap,
      progress({
        total: 2,
        completed: 0,
        failed: 1,
        outcome: "failure",
        entryId: "broken",
        critical: true,
      }),
    );
    snap = applyProgress(
      snap,
      progress({
        total: 2,
        completed: 1,
        failed: 1,
        outcome: "success",
        entryId: "ok",
      }),
    );
    expect(snap.phase).toBe("failed-critical");
  });

  it("idempotently produces the same output for the same input pair", () => {
    const before = startLoading(MANIFEST_ID, 3);
    const event = progress({ total: 3, completed: 1, entryId: "a" });
    const a = applyProgress(before, event);
    const b = applyProgress(before, event);
    expect(a).toEqual(b);
  });

  it("does not mutate the input snapshot", () => {
    const before = startLoading(MANIFEST_ID, 2);
    const beforeWarnings = before.warnings;
    applyProgress(before, progress({ outcome: "failure", critical: false, entryId: "x" }));
    expect(before.warnings).toBe(beforeWarnings);
    expect(before.warnings).toEqual([]);
  });

  it("dedupes repeated warning and critical failure events by entry id", () => {
    let snap = startLoading(MANIFEST_ID, 4);
    const warning = progress({
      outcome: "failure",
      critical: false,
      entryId: "optional-atlas",
      completed: 0,
      failed: 1,
    });
    snap = applyProgress(snap, warning);
    snap = applyProgress(snap, warning);
    expect(snap.warnings).toEqual(["optional-atlas"]);

    const critical = progress({
      outcome: "failure",
      critical: true,
      entryId: "required-atlas",
      completed: 0,
      failed: 2,
    });
    snap = applyProgress(snap, critical);
    snap = applyProgress(snap, critical);
    expect(snap.criticalFailures).toEqual(["required-atlas"]);
    expect(formatLoadingText(snap)).toBe(
      "Loading failed: 1 required asset unavailable",
    );
  });
});

describe("formatLoadingText", () => {
  it("idle yields 'Nothing to load'", () => {
    expect(formatLoadingText(EMPTY_SNAPSHOT)).toBe("Nothing to load");
  });

  it("loading reports 'Loading X of Y'", () => {
    let snap = startLoading(MANIFEST_ID, 5);
    snap = applyProgress(snap, progress({ total: 5, completed: 2 }));
    expect(formatLoadingText(snap)).toBe("Loading 2 of 5");
  });

  it("ready with no warnings reports 'Loaded X of Y'", () => {
    let snap = startLoading(MANIFEST_ID, 2);
    snap = applyProgress(snap, progress({ total: 2, completed: 1, entryId: "a" }));
    snap = applyProgress(snap, progress({ total: 2, completed: 2, entryId: "b" }));
    expect(formatLoadingText(snap)).toBe("Loaded 2 of 2");
  });

  it("ready with warnings notes the skipped count", () => {
    let snap = startLoading(MANIFEST_ID, 3);
    snap = applyProgress(
      snap,
      progress({
        total: 3,
        completed: 1,
        outcome: "success",
        entryId: "a",
      }),
    );
    snap = applyProgress(
      snap,
      progress({
        total: 3,
        completed: 1,
        failed: 1,
        outcome: "failure",
        entryId: "skip-me",
        critical: false,
      }),
    );
    snap = applyProgress(
      snap,
      progress({
        total: 3,
        completed: 2,
        failed: 1,
        outcome: "success",
        entryId: "b",
      }),
    );
    expect(formatLoadingText(snap)).toBe(
      "Loaded 2 of 3, 1 optional asset skipped",
    );
  });

  it("failed-critical reports the failure count", () => {
    let snap = startLoading(MANIFEST_ID, 2);
    snap = applyProgress(
      snap,
      progress({
        total: 2,
        completed: 0,
        failed: 1,
        outcome: "failure",
        entryId: "broken",
        critical: true,
      }),
    );
    expect(formatLoadingText(snap)).toBe(
      "Loading failed: 1 required asset unavailable",
    );
  });
});

describe("progressFraction", () => {
  it("0 when total is positive but nothing settled", () => {
    expect(progressFraction(startLoading(MANIFEST_ID, 4))).toBe(0);
  });

  it("1 when total is 0 (idle)", () => {
    expect(progressFraction(EMPTY_SNAPSHOT)).toBe(1);
  });

  it("counts failures as settled so the bar still reaches 1", () => {
    let snap = startLoading(MANIFEST_ID, 2);
    snap = applyProgress(
      snap,
      progress({ total: 2, completed: 1, outcome: "success", entryId: "a" }),
    );
    snap = applyProgress(
      snap,
      progress({
        total: 2,
        completed: 1,
        failed: 1,
        outcome: "failure",
        entryId: "b",
        critical: false,
      }),
    );
    expect(progressFraction(snap)).toBe(1);
  });

  it("returns the fraction for an in-flight load", () => {
    let snap = startLoading(MANIFEST_ID, 4);
    snap = applyProgress(
      snap,
      progress({ total: 4, completed: 1, outcome: "success", entryId: "a" }),
    );
    expect(progressFraction(snap)).toBeCloseTo(0.25, 5);
  });
});
