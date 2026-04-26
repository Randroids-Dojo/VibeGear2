/**
 * Fixed-step simulation loop with rAF interpolation.
 *
 * Implements the recipe pinned in
 * docs/gdd/21-technical-design-for-web-implementation.md §"Game loop":
 *
 *   renderLoop (rAF):
 *     accumulate dt
 *     while accumulator >= fixedStep:
 *       simulateRace(1/60)
 *     renderFrame(interpolatedState)
 *
 * The simulation advances in deterministic 1/60 s steps regardless of the
 * display refresh rate. The render callback is invoked once per rAF tick
 * with an `alpha` in [0, 1) that downstream code can use to blend the
 * previous and current sim states for smooth motion on > 60 Hz monitors.
 *
 * Spiral-of-death prevention: when the tab is backgrounded the browser
 * pauses rAF, so on resume `dt` may be many seconds. The accumulator is
 * capped at `MAX_ACCUMULATOR_MS` so the sim does not stall trying to
 * catch up. Caller can observe how many ticks were dropped.
 */

/** Fixed simulation step in seconds. 60 Hz per §21 "Physics update model". */
export const FIXED_STEP_SECONDS = 1 / 60;

/** Fixed step expressed in milliseconds for accumulator math. */
export const FIXED_STEP_MS = 1000 / 60;

/**
 * Hard cap on the accumulator. Anything beyond this is dropped to prevent
 * the spiral-of-death after a long tab-inactive pause. 250 ms = 15 frames
 * of catch-up max, which keeps a single render frame's catch-up bounded.
 */
export const MAX_ACCUMULATOR_MS = 250;

/**
 * Minimal scheduler interface. Defaults to globalThis.requestAnimationFrame.
 * `cancel` is a no-op for non-rAF schedulers; the loop's `stop()` flag is
 * the authoritative termination signal.
 */
export interface Scheduler {
  request(cb: (timestamp: number) => void): number;
  cancel(handle: number): void;
}

export interface LoopCallbacks {
  /** Called for each fixed simulation step. dt is always FIXED_STEP_SECONDS. */
  simulate: (dt: number) => void;
  /**
   * Called once per rAF tick after all due simulate() calls.
   * `alpha` is the fractional accumulator in [0, 1), suitable for blending
   * the previous and current sim states.
   */
  render: (alpha: number) => void;
}

export interface LoopOptions extends LoopCallbacks {
  /** Override scheduler for tests. Defaults to requestAnimationFrame. */
  scheduler?: Scheduler;
  /** Override accumulator cap. Defaults to MAX_ACCUMULATOR_MS. */
  maxAccumulatorMs?: number;
}

export interface LoopHandle {
  /** Stop the loop. Idempotent. */
  stop: () => void;
  /** True between start and stop. */
  isRunning: () => boolean;
  /**
   * Pause the simulation. Render still fires every tick (so the last frame
   * stays on screen and any UI overlay can repaint), but `simulate` is
   * skipped and the accumulator is held at zero. Idempotent. Per the §20
   * pause overlay dot, this is the entry point the overlay component uses
   * when it opens.
   */
  pause: () => void;
  /**
   * Resume the simulation. The accumulator is left at zero so a long pause
   * does not produce a sim-burst on the next frame. Idempotent.
   */
  resume: () => void;
  /** True while paused. */
  isPaused: () => boolean;
  /**
   * Drive a single rAF tick using `timestamp`. Exposed for deterministic
   * tests; the production scheduler invokes this internally.
   */
  tickFor: (timestamp: number) => LoopTickResult;
}

export interface LoopTickResult {
  /** Number of simulate() calls fired this tick. */
  simSteps: number;
  /** Accumulator value after this tick, in milliseconds. */
  remainderMs: number;
  /** Render alpha used this tick, in [0, 1). */
  alpha: number;
  /** Frames dropped because the accumulator was capped. */
  droppedSteps: number;
}

function fallbackNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

const defaultScheduler: Scheduler = {
  request(cb) {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(cb);
    }
    // Fallback for non-DOM hosts. setTimeout returns a Timer in node;
    // coerce so the handle type matches.
    return setTimeout(() => cb(fallbackNow()), 16) as unknown as number;
  },
  cancel(handle) {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  },
};

/**
 * Start a fixed-step loop. Returns a handle the caller can use to stop it
 * and (in tests) to drive ticks manually.
 *
 * The first scheduled callback is treated as the timing origin: no sim
 * ticks fire on the first frame because `dt` is 0 by definition.
 */
export function startLoop(options: LoopOptions): LoopHandle {
  const { simulate, render } = options;
  const scheduler = options.scheduler ?? defaultScheduler;
  const maxAccumulator = options.maxAccumulatorMs ?? MAX_ACCUMULATOR_MS;

  if (maxAccumulator < FIXED_STEP_MS) {
    throw new RangeError(
      `maxAccumulatorMs must be >= one fixed step (${FIXED_STEP_MS} ms), got ${maxAccumulator}`,
    );
  }

  let accumulatorMs = 0;
  let lastTimestamp: number | null = null;
  let running = true;
  let paused = false;
  let pendingHandle: number | null = null;

  function tickFor(timestamp: number): LoopTickResult {
    let droppedSteps = 0;

    if (lastTimestamp === null) {
      // Establish the timing origin on the first frame. No sim runs.
      lastTimestamp = timestamp;
      const alpha = 0;
      render(alpha);
      return { simSteps: 0, remainderMs: 0, alpha, droppedSteps: 0 };
    }

    if (paused) {
      // Hold the timing origin at "now" so the moment we resume the
      // accumulator starts from zero and we do not catch up the elapsed
      // pause duration. Render still fires so any pause overlay can
      // repaint over the last frame.
      lastTimestamp = timestamp;
      accumulatorMs = 0;
      const alpha = 0;
      render(alpha);
      return { simSteps: 0, remainderMs: 0, alpha, droppedSteps: 0 };
    }

    const dt = Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    accumulatorMs += dt;

    if (accumulatorMs > maxAccumulator) {
      const droppedMs = accumulatorMs - maxAccumulator;
      droppedSteps = Math.floor(droppedMs / FIXED_STEP_MS);
      accumulatorMs = maxAccumulator;
    }

    // FP carry tolerance: a pile of subtract-step operations can leave
    // the accumulator a few ULPs below the step boundary even when the
    // physical timeline is on the boundary. Allowing a sub-microsecond
    // epsilon keeps `n * step ms` producing exactly `n` ticks.
    const EPSILON_MS = 1e-9;

    let simSteps = 0;
    while (accumulatorMs + EPSILON_MS >= FIXED_STEP_MS) {
      simulate(FIXED_STEP_SECONDS);
      accumulatorMs -= FIXED_STEP_MS;
      simSteps += 1;
    }
    if (accumulatorMs < 0) accumulatorMs = 0;

    const alpha = accumulatorMs / FIXED_STEP_MS;
    render(alpha);
    return { simSteps, remainderMs: accumulatorMs, alpha, droppedSteps };
  }

  function frame(timestamp: number): void {
    if (!running) return;
    tickFor(timestamp);
    if (running) {
      pendingHandle = scheduler.request(frame);
    }
  }

  pendingHandle = scheduler.request(frame);

  return {
    stop() {
      running = false;
      if (pendingHandle !== null) {
        scheduler.cancel(pendingHandle);
        pendingHandle = null;
      }
    },
    isRunning() {
      return running;
    },
    pause() {
      paused = true;
    },
    resume() {
      if (!paused) return;
      paused = false;
      // Drop any accumulated drift so a long pause does not produce a
      // sim-burst on the next frame. The next tickFor call will treat
      // its timestamp as the new origin.
      accumulatorMs = 0;
      lastTimestamp = null;
    },
    isPaused() {
      return paused;
    },
    tickFor,
  };
}
