/**
 * Unit tests for the deterministic input layer.
 *
 * Covers the `Input` shape contract, the §19 keyboard / gamepad bindings,
 * the cancellation rule for opposite directions, and the edge cases
 * called out in the slice dot (gamepad disconnect, focus loss).
 */

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  PAD_BUTTON,
  STICK_DEADZONE,
  TRIGGER_DEADZONE,
  applyDeadzone,
  createInputManager,
  inputFromActions,
  inputFromGamepad,
  mergeInputs,
  type Action,
  type GamepadSource,
  type KeyTarget,
} from "@/game/input";

// Test doubles -------------------------------------------------------------

type EventName = "keydown" | "keyup" | "blur";

/**
 * Minimal `KeyTarget` stub. Records listeners so the test can dispatch
 * synthesised key events deterministically and verify dispose() unhooks
 * everything.
 */
function makeKeyTarget(): {
  target: KeyTarget;
  fireKeyDown: (init: { code?: string; key?: string }) => void;
  fireKeyUp: (init: { code?: string; key?: string }) => void;
  fireBlur: () => void;
  listenerCount: () => number;
} {
  const listeners = new Map<EventName, Set<(ev: KeyboardEvent | Event) => void>>();
  listeners.set("keydown", new Set());
  listeners.set("keyup", new Set());
  listeners.set("blur", new Set());

  const target: KeyTarget = {
    addEventListener(type, listener) {
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
  };

  function fire(type: EventName, ev: KeyboardEvent | Event): void {
    const set = listeners.get(type);
    if (!set) return;
    for (const listener of set) listener(ev);
  }

  return {
    target,
    fireKeyDown(init) {
      fire("keydown", { code: init.code ?? "", key: init.key ?? "" } as unknown as KeyboardEvent);
    },
    fireKeyUp(init) {
      fire("keyup", { code: init.code ?? "", key: init.key ?? "" } as unknown as KeyboardEvent);
    },
    fireBlur() {
      fire("blur", {} as Event);
    },
    listenerCount() {
      let total = 0;
      for (const set of listeners.values()) total += set.size;
      return total;
    },
  };
}

/** Build a partial gamepad button readout matching the standard mapping. */
function pad(opts: {
  pressed?: ReadonlyArray<number>;
  values?: Readonly<Record<number, number>>;
  axes?: ReadonlyArray<number>;
  connected?: boolean;
}): Gamepad {
  const pressed = new Set(opts.pressed ?? []);
  const values = opts.values ?? {};
  const buttonCount = 17; // standard mapping has 17 buttons
  const buttons: GamepadButton[] = [];
  for (let i = 0; i < buttonCount; i++) {
    const value = values[i] ?? (pressed.has(i) ? 1 : 0);
    buttons.push({ pressed: pressed.has(i), touched: pressed.has(i), value } as GamepadButton);
  }
  const axes = opts.axes ?? [0, 0, 0, 0];
  return {
    axes,
    buttons,
    connected: opts.connected ?? true,
    id: "stub",
    index: 0,
    mapping: "standard",
    timestamp: 0,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

// Pure helpers -------------------------------------------------------------

describe("inputFromActions", () => {
  it("returns NEUTRAL_INPUT for an empty held set", () => {
    expect(inputFromActions(new Set())).toEqual(NEUTRAL_INPUT);
  });

  it("maps left and right to steer", () => {
    expect(inputFromActions(new Set<Action>(["left"])).steer).toBe(-1);
    expect(inputFromActions(new Set<Action>(["right"])).steer).toBe(1);
  });

  it("cancels opposite steer keys to zero", () => {
    const got = inputFromActions(new Set<Action>(["left", "right"]));
    expect(got.steer).toBe(0);
  });

  it("treats brake+accelerate as brake-wins", () => {
    const got = inputFromActions(new Set<Action>(["accelerate", "brake"]));
    expect(got.throttle).toBe(0);
    expect(got.brake).toBe(1);
  });

  it("passes through digital nitro, handbrake, pause, shifts", () => {
    const got = inputFromActions(
      new Set<Action>(["nitro", "handbrake", "pause", "shiftUp", "shiftDown"]),
    );
    expect(got.nitro).toBe(true);
    expect(got.handbrake).toBe(true);
    expect(got.pause).toBe(true);
    expect(got.shiftUp).toBe(true);
    expect(got.shiftDown).toBe(true);
  });
});

describe("applyDeadzone", () => {
  it("zeros readings inside the deadzone", () => {
    expect(applyDeadzone(0.05, STICK_DEADZONE)).toBe(0);
    expect(applyDeadzone(-0.1, STICK_DEADZONE)).toBe(0);
  });

  it("rescales above the deadzone so the usable range still spans [-1, 1]", () => {
    expect(applyDeadzone(1, STICK_DEADZONE)).toBeCloseTo(1, 6);
    expect(applyDeadzone(-1, STICK_DEADZONE)).toBeCloseTo(-1, 6);
    // Just above deadzone returns near 0.
    expect(applyDeadzone(STICK_DEADZONE + 1e-3, STICK_DEADZONE)).toBeGreaterThan(0);
    expect(applyDeadzone(STICK_DEADZONE + 1e-3, STICK_DEADZONE)).toBeLessThan(0.01);
  });

  it("clamps out-of-range and non-finite values", () => {
    expect(applyDeadzone(2, STICK_DEADZONE)).toBeCloseTo(1, 6);
    expect(applyDeadzone(-2, STICK_DEADZONE)).toBeCloseTo(-1, 6);
    expect(applyDeadzone(Number.NaN, STICK_DEADZONE)).toBe(0);
    // Infinity is not finite, so the function treats it as zero rather
    // than trusting the reading. Pads should never report Infinity.
    expect(applyDeadzone(Number.POSITIVE_INFINITY, STICK_DEADZONE)).toBe(0);
  });
});

describe("inputFromGamepad", () => {
  it("returns neutral for null / disconnected pads", () => {
    expect(inputFromGamepad(null)).toEqual(NEUTRAL_INPUT);
    expect(inputFromGamepad(pad({ connected: false }))).toEqual(NEUTRAL_INPUT);
  });

  it("maps RT to throttle and LT to brake (analog)", () => {
    const got = inputFromGamepad(
      pad({ values: { [PAD_BUTTON.RT]: 0.75, [PAD_BUTTON.LT]: 0.4 } }),
    );
    // applyDeadzone with TRIGGER_DEADZONE rescales but stays close.
    expect(got.throttle).toBeGreaterThan(0.7);
    expect(got.brake).toBeGreaterThan(0.3);
  });

  it("respects the trigger deadzone", () => {
    const got = inputFromGamepad(
      pad({ values: { [PAD_BUTTON.RT]: TRIGGER_DEADZONE - 1e-4 } }),
    );
    expect(got.throttle).toBe(0);
  });

  it("maps Square=nitro, Cross=handbrake, Start=pause, RB=shiftUp, LB=shiftDown", () => {
    const got = inputFromGamepad(
      pad({
        pressed: [
          PAD_BUTTON.SQUARE,
          PAD_BUTTON.CROSS,
          PAD_BUTTON.START,
          PAD_BUTTON.RB,
          PAD_BUTTON.LB,
        ],
      }),
    );
    expect(got.nitro).toBe(true);
    expect(got.handbrake).toBe(true);
    expect(got.pause).toBe(true);
    expect(got.shiftUp).toBe(true);
    expect(got.shiftDown).toBe(true);
  });

  it("maps left stick X to steer through the deadzone", () => {
    expect(inputFromGamepad(pad({ axes: [0.1, 0, 0, 0] })).steer).toBe(0);
    expect(inputFromGamepad(pad({ axes: [1, 0, 0, 0] })).steer).toBeCloseTo(1, 6);
    expect(inputFromGamepad(pad({ axes: [-1, 0, 0, 0] })).steer).toBeCloseTo(-1, 6);
  });
});

describe("mergeInputs", () => {
  it("keyboard steer wins over pad steer when set", () => {
    const kb = inputFromActions(new Set<Action>(["left"]));
    const padInput = inputFromGamepad(pad({ axes: [1, 0, 0, 0] }));
    expect(mergeInputs(kb, padInput).steer).toBe(-1);
  });

  it("pad steer applies when keyboard steer is zero", () => {
    const kb = inputFromActions(new Set());
    const padInput = inputFromGamepad(pad({ axes: [0.8, 0, 0, 0] }));
    expect(mergeInputs(kb, padInput).steer).toBeGreaterThan(0.5);
  });

  it("ORs booleans across both devices", () => {
    const kb = inputFromActions(new Set<Action>(["nitro"]));
    const padInput = inputFromGamepad(pad({ pressed: [PAD_BUTTON.START] }));
    const merged = mergeInputs(kb, padInput);
    expect(merged.nitro).toBe(true);
    expect(merged.pause).toBe(true);
  });
});

// Manager ------------------------------------------------------------------

describe("createInputManager", () => {
  it("samples NEUTRAL_INPUT before any events", () => {
    const { target } = makeKeyTarget();
    const mgr = createInputManager({ keyTarget: target, gamepadSource: null });
    expect(mgr.sample()).toEqual(NEUTRAL_INPUT);
    mgr.dispose();
  });

  it("tracks held keys across keydown / keyup events", () => {
    const kt = makeKeyTarget();
    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: null });

    kt.fireKeyDown({ code: "ArrowUp" });
    expect(mgr.sample().throttle).toBe(1);

    kt.fireKeyDown({ code: "ArrowRight" });
    const mid = mgr.sample();
    expect(mid.throttle).toBe(1);
    expect(mid.steer).toBe(1);

    kt.fireKeyUp({ code: "ArrowUp" });
    expect(mgr.sample().throttle).toBe(0);

    mgr.dispose();
  });

  it("applies the cancellation rule for left+right held simultaneously", () => {
    const kt = makeKeyTarget();
    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: null });

    kt.fireKeyDown({ code: "ArrowLeft" });
    kt.fireKeyDown({ code: "ArrowRight" });
    expect(mgr.sample().steer).toBe(0);

    kt.fireKeyUp({ code: "ArrowLeft" });
    expect(mgr.sample().steer).toBe(1);

    mgr.dispose();
  });

  it("accepts both code and key tokens from the binding map", () => {
    const kt = makeKeyTarget();
    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: null });

    // The default binding lists Escape under `pause`. Some browsers report
    // it via `key` rather than `code`; both should work.
    kt.fireKeyDown({ key: "Escape" });
    expect(mgr.sample().pause).toBe(true);

    mgr.dispose();
  });

  it("clears all held keys on blur (focus lost)", () => {
    const kt = makeKeyTarget();
    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: null });

    kt.fireKeyDown({ code: "ArrowUp" });
    kt.fireKeyDown({ code: "ArrowLeft" });
    expect(mgr.sample().throttle).toBe(1);

    kt.fireBlur();
    expect(mgr.sample()).toEqual(NEUTRAL_INPUT);

    mgr.dispose();
  });

  it("merges keyboard and gamepad inputs via the supplied source", () => {
    const kt = makeKeyTarget();
    let snapshot: ReadonlyArray<Gamepad | null> = [pad({ axes: [0.9, 0, 0, 0] })];
    const source: GamepadSource = () => snapshot;

    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: source });
    expect(mgr.sample().steer).toBeGreaterThan(0.5);
    expect(mgr.hasGamepad()).toBe(true);

    // Keyboard steer takes precedence when set.
    kt.fireKeyDown({ code: "ArrowLeft" });
    expect(mgr.sample().steer).toBe(-1);

    // Pad disconnect mid-race: the manager must keep working from keyboard.
    snapshot = [];
    kt.fireKeyUp({ code: "ArrowLeft" });
    expect(mgr.sample()).toEqual(NEUTRAL_INPUT);
    expect(mgr.hasGamepad()).toBe(false);

    mgr.dispose();
  });

  it("survives a gamepad source that throws", () => {
    const kt = makeKeyTarget();
    const source: GamepadSource = () => {
      throw new Error("focus lost");
    };
    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: source });
    expect(() => mgr.sample()).not.toThrow();
    expect(mgr.sample()).toEqual(NEUTRAL_INPUT);
    mgr.dispose();
  });

  it("dispose() removes all listeners and is idempotent", () => {
    const kt = makeKeyTarget();
    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: null });
    expect(kt.listenerCount()).toBe(3);
    mgr.dispose();
    expect(kt.listenerCount()).toBe(0);
    mgr.dispose();
    expect(kt.listenerCount()).toBe(0);
  });

  it("ignores keys outside the binding map", () => {
    const kt = makeKeyTarget();
    const mgr = createInputManager({ keyTarget: kt.target, gamepadSource: null });
    kt.fireKeyDown({ code: "F1" });
    expect(mgr.sample()).toEqual(NEUTRAL_INPUT);
    mgr.dispose();
  });

  it("works with a null keyTarget (headless / SSR)", () => {
    const mgr = createInputManager({ keyTarget: null, gamepadSource: null });
    expect(mgr.sample()).toEqual(NEUTRAL_INPUT);
    mgr.dispose();
  });

  it("supports custom bindings", () => {
    const kt = makeKeyTarget();
    const mgr = createInputManager({
      keyTarget: kt.target,
      gamepadSource: null,
      bindings: {
        accelerate: ["KeyZ"],
        brake: ["KeyX"],
        left: ["KeyJ"],
        right: ["KeyL"],
        nitro: ["KeyN"],
        handbrake: ["KeyH"],
        pause: ["KeyP"],
        shiftUp: ["KeyU"],
        shiftDown: ["KeyY"],
      },
    });

    kt.fireKeyDown({ code: "KeyZ" });
    kt.fireKeyDown({ code: "KeyL" });
    const got = mgr.sample();
    expect(got.throttle).toBe(1);
    expect(got.steer).toBe(1);

    // Default bindings should NOT trigger.
    kt.fireKeyDown({ code: "ArrowUp" });
    const got2 = mgr.sample();
    expect(got2.steer).toBe(1);
    expect(got2.throttle).toBe(1);
    // No new effect from the default ArrowUp binding.

    mgr.dispose();
  });
});
