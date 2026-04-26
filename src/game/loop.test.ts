import { describe, expect, it } from "vitest";
import {
  FIXED_STEP_MS,
  FIXED_STEP_SECONDS,
  MAX_ACCUMULATOR_MS,
  startLoop,
  type LoopHandle,
  type Scheduler,
} from "./loop";

/**
 * A scheduler that records every requested callback but never invokes it.
 * Tests use the returned LoopHandle.tickFor to drive frames manually,
 * which lets every test deterministically control time without timers.
 */
function makeManualScheduler(): { scheduler: Scheduler; cancels: number[] } {
  const cancels: number[] = [];
  let nextHandle = 1;
  const scheduler: Scheduler = {
    request() {
      return nextHandle++;
    },
    cancel(handle) {
      cancels.push(handle);
    },
  };
  return { scheduler, cancels };
}

interface TestLoopRecord {
  simCalls: number[];
  renderAlphas: number[];
  handle: LoopHandle;
}

function makeTestLoop(maxAccumulatorMs?: number): TestLoopRecord {
  const simCalls: number[] = [];
  const renderAlphas: number[] = [];
  const { scheduler } = makeManualScheduler();
  const handle = startLoop({
    simulate: (dt) => simCalls.push(dt),
    render: (alpha) => renderAlphas.push(alpha),
    scheduler,
    maxAccumulatorMs,
  });
  return { simCalls, renderAlphas, handle };
}

describe("startLoop", () => {
  it("fires no sim ticks on the first frame and uses zero alpha", () => {
    const { simCalls, renderAlphas, handle } = makeTestLoop();
    const result = handle.tickFor(0);
    expect(simCalls).toEqual([]);
    expect(renderAlphas).toEqual([0]);
    expect(result.simSteps).toBe(0);
    expect(result.alpha).toBe(0);
    expect(result.droppedSteps).toBe(0);
  });

  it("advances exactly one sim tick per fixed step elapsed", () => {
    const { simCalls, handle } = makeTestLoop();
    handle.tickFor(0);
    const result = handle.tickFor(FIXED_STEP_MS);
    expect(simCalls).toHaveLength(1);
    expect(simCalls[0]).toBe(FIXED_STEP_SECONDS);
    expect(result.simSteps).toBe(1);
    expect(result.remainderMs).toBeCloseTo(0, 9);
    expect(result.alpha).toBeCloseTo(0, 9);
  });

  it("produces exactly 6 sim ticks for 100 ms elapsed at 60 Hz", () => {
    const { simCalls, handle } = makeTestLoop();
    handle.tickFor(0);
    const result = handle.tickFor(100);

    expect(simCalls).toHaveLength(6);
    for (const dt of simCalls) {
      expect(dt).toBe(FIXED_STEP_SECONDS);
    }
    expect(result.simSteps).toBe(6);
    // 100 ms - 6 * 16.6667 ms = 0.0 ms remainder (within float tolerance).
    // 6 steps at 60 Hz = 100 ms exactly, so the leftover is 0.
    expect(result.remainderMs).toBeCloseTo(0, 4);
    expect(result.alpha).toBeCloseTo(0, 4);
  });

  it("preserves the fractional remainder across frames", () => {
    const { simCalls, handle } = makeTestLoop();
    handle.tickFor(0);

    // 25 ms = 1 step (16.6667 ms) + 8.3333 ms remainder
    const r1 = handle.tickFor(25);
    expect(r1.simSteps).toBe(1);
    expect(r1.remainderMs).toBeCloseTo(25 - FIXED_STEP_MS, 9);
    expect(r1.alpha).toBeCloseTo((25 - FIXED_STEP_MS) / FIXED_STEP_MS, 9);

    // Another 25 ms = 1 step plus the carried 8.3333, total 33.3333 ms
    // remainder before subtracting the new step: 8.3333 + 25 = 33.3333
    // After 2 steps fired this is 0.0 ms remainder. So the second tick
    // should fire exactly 2 sim steps.
    const r2 = handle.tickFor(50);
    expect(r2.simSteps).toBe(2);
    expect(r2.remainderMs).toBeCloseTo(0, 4);
    expect(simCalls).toHaveLength(3);
  });

  it("caps the accumulator to prevent the spiral of death after a long pause", () => {
    const { simCalls, handle } = makeTestLoop();
    handle.tickFor(0);
    // Simulate a 5-second tab-inactive pause.
    const result = handle.tickFor(5_000);

    // MAX_ACCUMULATOR_MS = 250 = 15 * (1000/60), so exactly 15 steps fire.
    const expectedSteps = Math.round(MAX_ACCUMULATOR_MS / FIXED_STEP_MS);
    expect(simCalls).toHaveLength(expectedSteps);
    expect(result.simSteps).toBe(expectedSteps);

    // Dropped steps = how many we would have run if not capped, minus
    // what we actually ran. (5000 - 250) ms worth of drops, in step units.
    const droppedMs = 5_000 - MAX_ACCUMULATOR_MS;
    const expectedDropped = Math.floor(droppedMs / FIXED_STEP_MS);
    expect(result.droppedSteps).toBe(expectedDropped);
  });

  it("respects a custom maxAccumulatorMs", () => {
    const { simCalls, handle } = makeTestLoop(FIXED_STEP_MS * 2);
    handle.tickFor(0);
    const result = handle.tickFor(1_000);

    expect(simCalls).toHaveLength(2);
    expect(result.simSteps).toBe(2);
    expect(result.droppedSteps).toBeGreaterThan(0);
  });

  it("rejects a maxAccumulatorMs smaller than one fixed step", () => {
    const { scheduler } = makeManualScheduler();
    expect(() =>
      startLoop({
        simulate: () => undefined,
        render: () => undefined,
        scheduler,
        maxAccumulatorMs: FIXED_STEP_MS / 2,
      }),
    ).toThrow(RangeError);
  });

  it("treats negative dt as zero", () => {
    // If a clock skews backward, the loop must not run sim steps
    // backward or generate negative accumulator state.
    const { simCalls, handle } = makeTestLoop();
    handle.tickFor(100);
    const result = handle.tickFor(50);
    expect(simCalls).toHaveLength(0);
    expect(result.simSteps).toBe(0);
    expect(result.remainderMs).toBe(0);
  });

  it("invokes render on every tick, including when no sim ticks fire", () => {
    const { renderAlphas, handle } = makeTestLoop();
    handle.tickFor(0);
    handle.tickFor(1);
    handle.tickFor(2);
    expect(renderAlphas).toHaveLength(3);
  });

  it("stop() flips isRunning and cancels pending requests", () => {
    const { scheduler, cancels } = makeManualScheduler();
    const handle = startLoop({
      simulate: () => undefined,
      render: () => undefined,
      scheduler,
    });
    expect(handle.isRunning()).toBe(true);
    handle.stop();
    expect(handle.isRunning()).toBe(false);
    expect(cancels).toHaveLength(1);

    // Idempotent.
    handle.stop();
    expect(handle.isRunning()).toBe(false);
    expect(cancels).toHaveLength(1);
  });

  it("pause() skips simulate but keeps render firing", () => {
    const { simCalls, renderAlphas, handle } = makeTestLoop();
    handle.tickFor(0);
    handle.tickFor(FIXED_STEP_MS);
    expect(simCalls).toHaveLength(1);

    handle.pause();
    expect(handle.isPaused()).toBe(true);

    // Drive 500 ms worth of frames while paused. Sim count must stay at 1,
    // render must keep ticking so an overlay can repaint.
    const renderCountBeforePause = renderAlphas.length;
    for (let t = FIXED_STEP_MS + 50; t <= FIXED_STEP_MS + 500; t += 50) {
      handle.tickFor(t);
    }
    expect(simCalls).toHaveLength(1);
    expect(renderAlphas.length).toBeGreaterThan(renderCountBeforePause);
  });

  it("resume() drains the accumulator so no sim-burst follows a long pause", () => {
    const { simCalls, handle } = makeTestLoop();
    handle.tickFor(0);
    handle.tickFor(FIXED_STEP_MS);
    expect(simCalls).toHaveLength(1);

    handle.pause();
    handle.tickFor(5_000);
    expect(simCalls).toHaveLength(1);

    handle.resume();
    expect(handle.isPaused()).toBe(false);

    // First post-resume tick reseats the timing origin: no sim runs.
    const firstAfter = handle.tickFor(5_010);
    expect(firstAfter.simSteps).toBe(0);
    expect(firstAfter.remainderMs).toBe(0);

    // Subsequent ticks advance normally, one step per fixed step elapsed.
    const next = handle.tickFor(5_010 + FIXED_STEP_MS);
    expect(next.simSteps).toBe(1);
    expect(simCalls).toHaveLength(2);
  });

  it("pause() and resume() are idempotent", () => {
    const { handle } = makeTestLoop();
    expect(handle.isPaused()).toBe(false);
    handle.pause();
    handle.pause();
    expect(handle.isPaused()).toBe(true);
    handle.resume();
    handle.resume();
    expect(handle.isPaused()).toBe(false);
  });

  it("auto-runs through the scheduler when one fires the callback", () => {
    // Build a scheduler that fires the next requested callback synchronously
    // exactly once, with a stop-after counter so we do not recurse forever.
    let firesLeft = 5;
    let nextTimestamp = 0;
    const scheduler: Scheduler = {
      request(cb) {
        if (firesLeft > 0) {
          firesLeft -= 1;
          nextTimestamp += FIXED_STEP_MS;
          cb(nextTimestamp);
        }
        return 0;
      },
      cancel() {},
    };

    const simCalls: number[] = [];
    const renderAlphas: number[] = [];
    startLoop({
      simulate: (dt) => simCalls.push(dt),
      render: (alpha) => renderAlphas.push(alpha),
      scheduler,
    });

    // 5 frames fired: the first establishes the origin (0 sim), each
    // subsequent frame advances exactly one fixed step. Render fires
    // every frame.
    expect(renderAlphas).toHaveLength(5);
    expect(simCalls).toHaveLength(4);
  });
});
