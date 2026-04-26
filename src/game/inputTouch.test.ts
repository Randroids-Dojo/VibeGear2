/**
 * Tests for the touch / mobile input source (closes F-013).
 *
 * Covers the pure projection helper, the stateful pointer-tracking
 * manager, and the integration with `createInputManager` via the new
 * `touchTarget` option.
 */

import { describe, expect, it } from "vitest";

import {
  createInputManager,
  inputFromActions,
  mergeWithTouch,
  NEUTRAL_INPUT,
  type Action,
} from "./input";
import {
  DEFAULT_TOUCH_LAYOUT,
  createTouchInputSource,
  inputFromTouchState,
  type TouchLayout,
  type TouchPointer,
  type TouchState,
  type TouchTarget,
} from "./inputTouch";

// Test doubles -------------------------------------------------------------

type TouchEventName = "pointerdown" | "pointermove" | "pointerup" | "pointercancel" | "blur";

interface FakeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Minimal `TouchTarget` stub. Records listeners so the test can fire
 * synthetic pointer events deterministically and verify dispose()
 * unhooks everything. Lets the test set the bounding rect freely.
 */
function makeTouchTarget(rect?: Partial<FakeRect>): {
  target: TouchTarget;
  fire: (type: TouchEventName, payload?: Record<string, unknown>) => void;
  listenerCount: () => number;
  setRect: (next: Partial<FakeRect>) => void;
} {
  const listeners = new Map<TouchEventName, Set<(ev: Event) => void>>();
  for (const t of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "blur",
  ] as TouchEventName[]) {
    listeners.set(t, new Set());
  }
  let currentRect: FakeRect = {
    left: rect?.left ?? 0,
    top: rect?.top ?? 0,
    width: rect?.width ?? DEFAULT_TOUCH_LAYOUT.width,
    height: rect?.height ?? DEFAULT_TOUCH_LAYOUT.height,
  };

  const target: TouchTarget = {
    addEventListener(type, listener) {
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    getBoundingClientRect() {
      return currentRect as unknown as DOMRect;
    },
  };

  return {
    target,
    fire(type, payload = {}) {
      const set = listeners.get(type);
      if (!set) return;
      const ev = payload as unknown as Event;
      for (const listener of set) listener(ev);
    },
    listenerCount() {
      let total = 0;
      for (const set of listeners.values()) total += set.size;
      return total;
    },
    setRect(next) {
      currentRect = { ...currentRect, ...next };
    },
  };
}

function pointer(opts: {
  id: number;
  origin: [number, number];
  current?: [number, number];
}): TouchPointer {
  const [ox, oy] = opts.origin;
  const [cx, cy] = opts.current ?? opts.origin;
  return { id: opts.id, originX: ox, originY: oy, currentX: cx, currentY: cy };
}

function state(layout: TouchLayout, pointers: TouchPointer[]): TouchState {
  return { layout, pointers };
}

const LAYOUT: TouchLayout = { ...DEFAULT_TOUCH_LAYOUT };
const STEER_ZONE_MAX = LAYOUT.width * LAYOUT.steerZoneRatio;
const ACCEL_BRAKE_BOUNDARY_Y = LAYOUT.height * (1 - LAYOUT.brakeFraction);

// Pure helper --------------------------------------------------------------

describe("inputFromTouchState", () => {
  it("returns NEUTRAL_INPUT when no pointers are down", () => {
    expect(inputFromTouchState(state(LAYOUT, []))).toEqual(NEUTRAL_INPUT);
  });

  it("returns steer = 0 for a pointer in the steer zone with no offset (initial down)", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [pointer({ id: 1, origin: [80, 240] })]),
    );
    expect(got.steer).toBe(0);
  });

  it("returns steer = +1 when the steer pointer is dragged right by the max radius", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [80, 240],
          current: [80 + LAYOUT.stickMaxRadius, 240],
        }),
      ]),
    );
    expect(got.steer).toBe(1);
  });

  it("returns steer = -1 when the steer pointer is dragged left by the max radius", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [200, 240],
          current: [200 - LAYOUT.stickMaxRadius, 240],
        }),
      ]),
    );
    expect(got.steer).toBe(-1);
  });

  it("clamps steer to [-1, 1] when dragged past the max radius", () => {
    const farRight = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [80, 240],
          current: [80 + LAYOUT.stickMaxRadius * 5, 240],
        }),
      ]),
    );
    expect(farRight.steer).toBe(1);

    const farLeft = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [200, 240],
          current: [200 - LAYOUT.stickMaxRadius * 5, 240],
        }),
      ]),
    );
    expect(farLeft.steer).toBe(-1);
  });

  it("returns proportional steer for partial drag", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [80, 240],
          current: [80 + LAYOUT.stickMaxRadius / 2, 240],
        }),
      ]),
    );
    expect(got.steer).toBeCloseTo(0.5, 6);
  });

  it("returns zero steer when no pointer is in the steer zone", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [pointer({ id: 1, origin: [STEER_ZONE_MAX + 50, 100] })]),
    );
    expect(got.steer).toBe(0);
  });

  it("maps an accelerator-zone tap to throttle = 1", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [pointer({ id: 1, origin: [STEER_ZONE_MAX + 50, 100] })]),
    );
    expect(got.throttle).toBe(1);
    expect(got.brake).toBe(0);
  });

  it("maps a brake-zone tap to brake = 1", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [STEER_ZONE_MAX + 50, ACCEL_BRAKE_BOUNDARY_Y + 10],
        }),
      ]),
    );
    expect(got.brake).toBe(1);
    expect(got.throttle).toBe(0);
  });

  it("multi-touch: steer + accelerate populate both fields", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [80, 240],
          current: [80 + LAYOUT.stickMaxRadius, 240],
        }),
        pointer({ id: 2, origin: [STEER_ZONE_MAX + 50, 100] }),
      ]),
    );
    expect(got.steer).toBe(1);
    expect(got.throttle).toBe(1);
  });

  it("two pointers in the steer zone: latest wins", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [80, 240],
          current: [80 - LAYOUT.stickMaxRadius, 240],
        }),
        pointer({
          id: 2,
          origin: [120, 240],
          current: [120 + LAYOUT.stickMaxRadius, 240],
        }),
      ]),
    );
    expect(got.steer).toBe(1);
  });

  it("two pointers in the right zone: any in accelerator counts", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({ id: 1, origin: [STEER_ZONE_MAX + 50, 100] }),
        pointer({
          id: 2,
          origin: [STEER_ZONE_MAX + 80, ACCEL_BRAKE_BOUNDARY_Y + 5],
        }),
      ]),
    );
    expect(got.throttle).toBe(1);
    expect(got.brake).toBe(1);
  });

  it("nitro corner tap: nitro = true, no throttle", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [LAYOUT.width - LAYOUT.nitroCornerSize / 2, LAYOUT.nitroCornerSize / 2],
        }),
      ]),
    );
    expect(got.nitro).toBe(true);
    expect(got.throttle).toBe(0);
  });

  it("pause corner tap: pause = true", () => {
    const pauseX = LAYOUT.width - LAYOUT.nitroCornerSize - LAYOUT.pauseCornerSize / 2;
    const got = inputFromTouchState(
      state(LAYOUT, [pointer({ id: 1, origin: [pauseX, LAYOUT.pauseCornerSize / 2] })]),
    );
    expect(got.pause).toBe(true);
  });

  it("never sets handbrake / shifts (not bound on touch in this slice)", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [pointer({ id: 1, origin: [STEER_ZONE_MAX + 50, 100] })]),
    );
    expect(got.handbrake).toBe(false);
    expect(got.shiftUp).toBe(false);
    expect(got.shiftDown).toBe(false);
  });

  it("guards against a zero-radius layout (degenerate input)", () => {
    const got = inputFromTouchState(
      state(
        { ...LAYOUT, stickMaxRadius: 0 },
        [pointer({ id: 1, origin: [80, 240], current: [180, 240] })],
      ),
    );
    expect(got.steer).toBe(1);
  });

  it("guards against a non-finite current position", () => {
    const got = inputFromTouchState(
      state(LAYOUT, [
        pointer({
          id: 1,
          origin: [80, 240],
          current: [Number.NaN, 240],
        }),
      ]),
    );
    expect(got.steer).toBe(0);
  });
});

// mergeWithTouch -----------------------------------------------------------

describe("mergeWithTouch", () => {
  it("touch beats base when its abs steer is larger", () => {
    const base = { ...NEUTRAL_INPUT, steer: 0.3 };
    const touch = { ...NEUTRAL_INPUT, steer: -0.9 };
    const merged = mergeWithTouch(base, touch);
    expect(merged.steer).toBeCloseTo(-0.9, 6);
  });

  it("keyboard / pad wins when its abs steer is larger", () => {
    const kb = inputFromActions(new Set<Action>(["left"]));
    const touch = { ...NEUTRAL_INPUT, steer: 0.4 };
    const merged = mergeWithTouch(kb, touch);
    expect(merged.steer).toBe(-1);
  });

  it("on a tie, the base value wins (deterministic preference)", () => {
    const base = { ...NEUTRAL_INPUT, steer: 1 };
    const touch = { ...NEUTRAL_INPUT, steer: -1 };
    const merged = mergeWithTouch(base, touch);
    expect(merged.steer).toBe(1);
  });

  it("ORs booleans across both sources", () => {
    const base = { ...NEUTRAL_INPUT, nitro: false, pause: true };
    const touch = { ...NEUTRAL_INPUT, nitro: true };
    const merged = mergeWithTouch(base, touch);
    expect(merged.nitro).toBe(true);
    expect(merged.pause).toBe(true);
  });

  it("takes max of throttle and brake", () => {
    const base = { ...NEUTRAL_INPUT, throttle: 0.3, brake: 0.6 };
    const touch = { ...NEUTRAL_INPUT, throttle: 1, brake: 0.1 };
    const merged = mergeWithTouch(base, touch);
    expect(merged.throttle).toBe(1);
    expect(merged.brake).toBe(0.6);
  });
});

// Stateful manager ---------------------------------------------------------

describe("createTouchInputSource", () => {
  it("samples NEUTRAL_INPUT before any pointer events", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });
    expect(src.sample()).toEqual(NEUTRAL_INPUT);
    src.dispose();
  });

  it("tracks a pointerdown -> pointermove -> pointerup sequence in the steer zone", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });

    tt.fire("pointerdown", { pointerId: 1, clientX: 80, clientY: 240 });
    expect(src.sample().steer).toBe(0);

    tt.fire("pointermove", {
      pointerId: 1,
      clientX: 80 + DEFAULT_TOUCH_LAYOUT.stickMaxRadius,
      clientY: 240,
    });
    expect(src.sample().steer).toBe(1);

    tt.fire("pointerup", { pointerId: 1, clientX: 180, clientY: 240 });
    expect(src.sample()).toEqual(NEUTRAL_INPUT);

    src.dispose();
  });

  it("ignores pointermove for pointers it has not seen down", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });
    tt.fire("pointermove", { pointerId: 99, clientX: 0, clientY: 0 });
    expect(src.sample()).toEqual(NEUTRAL_INPUT);
    expect(src.hasActivePointers()).toBe(false);
    src.dispose();
  });

  it("multi-touch: steer pointer + accelerator pointer compose", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });

    tt.fire("pointerdown", { pointerId: 1, clientX: 80, clientY: 240 });
    tt.fire("pointermove", {
      pointerId: 1,
      clientX: 80 + DEFAULT_TOUCH_LAYOUT.stickMaxRadius,
      clientY: 240,
    });
    tt.fire("pointerdown", { pointerId: 2, clientX: STEER_ZONE_MAX + 50, clientY: 100 });

    const got = src.sample();
    expect(got.steer).toBe(1);
    expect(got.throttle).toBe(1);

    src.dispose();
  });

  it("pointercancel releases the pointer (no throw, no phantom hold)", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });

    tt.fire("pointerdown", { pointerId: 1, clientX: 80, clientY: 240 });
    tt.fire("pointermove", {
      pointerId: 1,
      clientX: 80 + DEFAULT_TOUCH_LAYOUT.stickMaxRadius,
      clientY: 240,
    });
    expect(src.sample().steer).toBe(1);

    expect(() =>
      tt.fire("pointercancel", { pointerId: 1, clientX: 180, clientY: 240 }),
    ).not.toThrow();
    expect(src.sample()).toEqual(NEUTRAL_INPUT);

    src.dispose();
  });

  it("blur clears all active pointers (mirrors keyboard blur)", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });
    tt.fire("pointerdown", { pointerId: 1, clientX: 80, clientY: 240 });
    tt.fire("pointerdown", { pointerId: 2, clientX: STEER_ZONE_MAX + 50, clientY: 100 });
    expect(src.hasActivePointers()).toBe(true);

    tt.fire("blur");
    expect(src.sample()).toEqual(NEUTRAL_INPUT);
    expect(src.hasActivePointers()).toBe(false);

    src.dispose();
  });

  it("dispose() removes all listeners and is idempotent", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });
    expect(tt.listenerCount()).toBe(5);
    src.dispose();
    expect(tt.listenerCount()).toBe(0);
    src.dispose();
    expect(tt.listenerCount()).toBe(0);
  });

  it("respects resetOnBlur = false (no blur listener)", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target, resetOnBlur: false });
    expect(tt.listenerCount()).toBe(4);
    src.dispose();
  });

  it("converts client coords to local coords using getBoundingClientRect()", () => {
    const tt = makeTouchTarget({ left: 100, top: 50 });
    const src = createTouchInputSource({ target: tt.target });
    // Client (180, 290) - rect (100, 50) = local (80, 240) which is inside steer zone.
    tt.fire("pointerdown", { pointerId: 1, clientX: 180, clientY: 290 });
    tt.fire("pointermove", {
      pointerId: 1,
      clientX: 180 + DEFAULT_TOUCH_LAYOUT.stickMaxRadius,
      clientY: 290,
    });
    expect(src.sample().steer).toBe(1);
    src.dispose();
  });

  it("works with a null target (headless / SSR)", () => {
    const src = createTouchInputSource({ target: null });
    expect(src.sample()).toEqual(NEUTRAL_INPUT);
    src.dispose();
  });

  it("re-anchors stick on the next pointerdown (orientation change scenario)", () => {
    const tt = makeTouchTarget();
    const src = createTouchInputSource({ target: tt.target });
    tt.fire("pointerdown", { pointerId: 1, clientX: 80, clientY: 240 });
    tt.fire("pointermove", {
      pointerId: 1,
      clientX: 80 + DEFAULT_TOUCH_LAYOUT.stickMaxRadius,
      clientY: 240,
    });
    tt.fire("pointerup", { pointerId: 1, clientX: 180, clientY: 240 });

    // New touch in a different position, no drag yet => steer = 0.
    tt.fire("pointerdown", { pointerId: 2, clientX: 150, clientY: 100 });
    expect(src.sample().steer).toBe(0);
    src.dispose();
  });

  it("uses the provided layout supplier (resize picked up per sample)", () => {
    const tt = makeTouchTarget({ width: 400, height: 240 });
    let layout: TouchLayout = { ...DEFAULT_TOUCH_LAYOUT, width: 400, height: 240 };
    const src = createTouchInputSource({
      target: tt.target,
      layout: () => layout,
    });
    tt.fire("pointerdown", { pointerId: 1, clientX: 50, clientY: 120 });
    tt.fire("pointermove", {
      pointerId: 1,
      clientX: 50 + layout.stickMaxRadius,
      clientY: 120,
    });
    expect(src.sample().steer).toBe(1);

    // Halve the max radius via the layout supplier; same drag now over-shoots.
    layout = { ...layout, stickMaxRadius: layout.stickMaxRadius / 2 };
    expect(src.sample().steer).toBe(1);
    src.dispose();
  });
});

// Integration with createInputManager --------------------------------------

describe("createInputManager(touchTarget)", () => {
  it("does not attach touch listeners when touchTarget is unset", () => {
    const tt = makeTouchTarget();
    const mgr = createInputManager({
      keyTarget: null,
      gamepadSource: null,
    });
    expect(mgr.hasTouch()).toBe(false);
    expect(tt.listenerCount()).toBe(0);
    mgr.dispose();
  });

  it("merges touch into samples when touchTarget is provided", () => {
    const tt = makeTouchTarget();
    const mgr = createInputManager({
      keyTarget: null,
      gamepadSource: null,
      touchTarget: tt.target,
    });
    expect(mgr.hasTouch()).toBe(false);

    tt.fire("pointerdown", { pointerId: 1, clientX: STEER_ZONE_MAX + 50, clientY: 100 });
    expect(mgr.hasTouch()).toBe(true);
    expect(mgr.sample().throttle).toBe(1);

    mgr.dispose();
  });

  it("touch dispose runs as part of manager dispose", () => {
    const tt = makeTouchTarget();
    const mgr = createInputManager({
      keyTarget: null,
      gamepadSource: null,
      touchTarget: tt.target,
    });
    expect(tt.listenerCount()).toBe(5);
    mgr.dispose();
    expect(tt.listenerCount()).toBe(0);
  });
});
