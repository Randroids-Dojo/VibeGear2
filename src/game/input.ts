/**
 * Deterministic input layer for the fixed-step simulation.
 *
 * Source of truth: `docs/gdd/19-controls-and-input.md`. The sim runs at a
 * fixed 60 Hz cadence (see `loop.ts`); browser keyboard and gamepad events
 * arrive on an arbitrary cadence, so this module decouples the two by
 * holding a "currently held" snapshot that the sim samples once per tick.
 *
 * Why this matters: §21 "Physics update model" requires deterministic
 * inputs. If the sim sampled events directly, two presses inside the same
 * 1/60 s window would produce different sim outputs depending on browser
 * timing, breaking the replay/ghost system spec'd in §21.
 *
 * The module is environment-agnostic. In production it subscribes to
 * `window` keyboard events and polls `navigator.getGamepads()` once per
 * `sample()` call. Tests inject a `KeyTarget` and a synthetic gamepad
 * source so no DOM is required.
 *
 * Touch / mobile is out of scope for this slice (tracked as F-NNN).
 */

/**
 * Stable input shape sampled once per sim tick.
 *
 * Ranges:
 * - `steer`: [-1, 1]. -1 = full left, +1 = full right.
 * - `throttle`: [0, 1]. Combined accelerator: keyboard digital, pad analog.
 * - `brake`: [0, 1]. Combined brake / reverse: digital or analog.
 * - `nitro`: boolean. Hold-to-nitro by default per §19; toggle is an
 *   accessibility option not modelled here.
 * - `handbrake`: boolean.
 * - `pause`: boolean. Edge-triggered consumers should debounce themselves.
 * - `shiftUp` / `shiftDown`: boolean. Manual gearbox sequential shifts.
 */
export interface Input {
  steer: number;
  throttle: number;
  brake: number;
  nitro: boolean;
  handbrake: boolean;
  pause: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
}

/** Neutral input. Returned when no controllers are present. */
export const NEUTRAL_INPUT: Readonly<Input> = Object.freeze({
  steer: 0,
  throttle: 0,
  brake: 0,
  nitro: false,
  handbrake: false,
  pause: false,
  shiftUp: false,
  shiftDown: false,
});

/**
 * Logical actions the game cares about. Keyboard keys and gamepad buttons
 * map onto these; the sim and accessibility layer only ever see actions.
 */
export type Action =
  | "accelerate"
  | "brake"
  | "left"
  | "right"
  | "nitro"
  | "handbrake"
  | "pause"
  | "shiftUp"
  | "shiftDown";

/**
 * Default keyboard binding from §19 "Keyboard layout". Each action lists
 * `KeyboardEvent.code` values (preferred over `key` so the binding is
 * layout-independent for letter keys) plus a small set of `key` aliases
 * for non-letter keys. The sample loop accepts either.
 */
export const DEFAULT_KEY_BINDINGS: Readonly<Record<Action, readonly string[]>> = Object.freeze({
  accelerate: ["ArrowUp", "KeyW"],
  brake: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  nitro: ["Space"],
  handbrake: ["ShiftLeft", "ShiftRight"],
  pause: ["Escape"],
  shiftUp: ["KeyE"],
  shiftDown: ["KeyQ"],
});

/**
 * Pure helper: given the currently-held actions, build the canonical
 * `Input` shape. Exported for tests and for callers that supply their own
 * action sources (touch, AI driver, replay).
 *
 * Cancellation rule (§19 edge case): left and right held simultaneously
 * resolves to steer = 0 rather than alternating. Same for brake vs
 * accelerate: both held results in throttle = 0 and brake = 1, since the
 * sim should treat the stop as authoritative when ambiguous.
 */
export function inputFromActions(held: ReadonlySet<Action>): Input {
  const left = held.has("left");
  const right = held.has("right");
  let steer = 0;
  if (left && !right) steer = -1;
  else if (right && !left) steer = 1;

  const accel = held.has("accelerate");
  const brake = held.has("brake");

  return {
    steer,
    throttle: accel && !brake ? 1 : 0,
    brake: brake ? 1 : 0,
    nitro: held.has("nitro"),
    handbrake: held.has("handbrake"),
    pause: held.has("pause"),
    shiftUp: held.has("shiftUp"),
    shiftDown: held.has("shiftDown"),
  };
}

/**
 * Combine keyboard-derived `Input` with gamepad-derived `Input`. The pad
 * "wins" on analog axes when it has any non-zero deflection; otherwise the
 * keyboard reading is used. Booleans OR together so either device can
 * trigger a press.
 *
 * Steering is a bit more nuanced: if the keyboard has steer != 0 the
 * keyboard wins (digital input is unambiguous), otherwise the pad analog
 * value passes through unchanged. This matches the intuitive "I'm holding
 * a key, ignore the stick drifting" behaviour.
 */
export function mergeInputs(keyboard: Input, pad: Input): Input {
  const steer = keyboard.steer !== 0 ? keyboard.steer : pad.steer;
  const throttle = Math.max(keyboard.throttle, pad.throttle);
  const brake = Math.max(keyboard.brake, pad.brake);
  return {
    steer,
    throttle,
    brake,
    nitro: keyboard.nitro || pad.nitro,
    handbrake: keyboard.handbrake || pad.handbrake,
    pause: keyboard.pause || pad.pause,
    shiftUp: keyboard.shiftUp || pad.shiftUp,
    shiftDown: keyboard.shiftDown || pad.shiftDown,
  };
}

// Gamepad mapping ----------------------------------------------------------

/**
 * Standard mapping button indices per
 * https://w3c.github.io/gamepad/#dfn-standard-gamepad. Listed here as
 * named constants so the rest of the module reads clearly.
 */
export const PAD_BUTTON = Object.freeze({
  CROSS: 0, // A on Xbox, Cross on PlayStation. §19: Handbrake on pad.
  CIRCLE: 1, // B / Circle.
  SQUARE: 2, // X / Square. §19: Nitro on pad.
  TRIANGLE: 3, // Y / Triangle.
  LB: 4, // §19: Shift down.
  RB: 5, // §19: Shift up.
  LT: 6, // §19: Brake / reverse (analog).
  RT: 7, // §19: Accelerate (analog).
  SELECT: 8,
  START: 9, // §19: Pause.
});

/**
 * Stick deflection below this magnitude is treated as zero. Most pads
 * have measurable rest-state drift around 0.05; 0.15 is the most common
 * default in racing games and matches what VibeRacer's settings expose.
 */
export const STICK_DEADZONE = 0.15;

/** Trigger reading below this is treated as zero. Triggers tend to be cleaner than sticks. */
export const TRIGGER_DEADZONE = 0.05;

/**
 * Apply a radial deadzone to a stick axis reading and rescale so the
 * usable range still covers [-1, 1] after the deadzone bite.
 */
export function applyDeadzone(value: number, deadzone: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value));
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadzone) return 0;
  const sign = clamped < 0 ? -1 : 1;
  const rescaled = (magnitude - deadzone) / (1 - deadzone);
  return sign * Math.max(0, Math.min(1, rescaled));
}

/**
 * Project a single `Gamepad` snapshot onto our canonical `Input` shape per
 * §19 "Gamepad layout". Buttons that are missing (off-spec pads) read as
 * "not pressed" rather than throwing.
 */
export function inputFromGamepad(pad: Gamepad | null | undefined): Input {
  if (!pad || !pad.connected) return { ...NEUTRAL_INPUT };
  const buttons = pad.buttons ?? [];
  const axes = pad.axes ?? [];

  const pressed = (i: number): boolean => Boolean(buttons[i]?.pressed);
  const triggerValue = (i: number): number => {
    const raw = buttons[i]?.value ?? 0;
    return applyDeadzone(raw, TRIGGER_DEADZONE);
  };

  const stickX = applyDeadzone(axes[0] ?? 0, STICK_DEADZONE);

  const throttleAnalog = triggerValue(PAD_BUTTON.RT);
  const brakeAnalog = triggerValue(PAD_BUTTON.LT);

  return {
    steer: stickX,
    throttle: throttleAnalog,
    brake: brakeAnalog,
    nitro: pressed(PAD_BUTTON.SQUARE),
    handbrake: pressed(PAD_BUTTON.CROSS),
    pause: pressed(PAD_BUTTON.START),
    shiftUp: pressed(PAD_BUTTON.RB),
    shiftDown: pressed(PAD_BUTTON.LB),
  };
}

// Manager ------------------------------------------------------------------

/**
 * Subset of `EventTarget` we depend on. Lets tests pass a plain object
 * with `addEventListener` / `removeEventListener` instead of a real DOM
 * `Window`, and lets callers attach the listener to a specific element
 * (e.g. the canvas) if focus management warrants it.
 */
export interface KeyTarget {
  addEventListener(
    type: "keydown" | "keyup" | "blur",
    listener: (ev: KeyboardEvent | Event) => void,
  ): void;
  removeEventListener(
    type: "keydown" | "keyup" | "blur",
    listener: (ev: KeyboardEvent | Event) => void,
  ): void;
}

/**
 * Source of `Gamepad` snapshots. Defaults to the browser
 * `navigator.getGamepads()` lookup. Tests inject a stub.
 */
export type GamepadSource = () => ReadonlyArray<Gamepad | null>;

export interface InputManagerOptions {
  /** Element to listen to keyboard + blur events on. Defaults to `globalThis.window`. */
  keyTarget?: KeyTarget | null;
  /** Function returning a snapshot of currently-attached gamepads. */
  gamepadSource?: GamepadSource | null;
  /**
   * Custom binding map. If omitted, `DEFAULT_KEY_BINDINGS` is used.
   * Each action lists `KeyboardEvent.code` (preferred) or `KeyboardEvent.key`
   * values; the sample loop accepts either.
   */
  bindings?: Readonly<Record<Action, readonly string[]>>;
}

export interface InputManager {
  /** Snapshot the currently-held input state. Cheap; safe to call once per sim tick. */
  sample: () => Input;
  /** Drop event listeners. Idempotent. */
  dispose: () => void;
  /** True if the manager currently sees a connected gamepad. Diagnostic only. */
  hasGamepad: () => boolean;
}

/**
 * Build the reverse lookup: keyboard token (`code` or `key`) -> set of
 * actions it triggers. A single token can be bound to multiple actions
 * (rare, but allowed); a single action can have multiple tokens (common).
 */
function buildKeyToActions(
  bindings: Readonly<Record<Action, readonly string[]>>,
): Map<string, Action[]> {
  const out = new Map<string, Action[]>();
  for (const action of Object.keys(bindings) as Action[]) {
    for (const token of bindings[action]) {
      const list = out.get(token);
      if (list) list.push(action);
      else out.set(token, [action]);
    }
  }
  return out;
}

/** Pick the default key target without throwing in non-DOM environments. */
function defaultKeyTarget(): KeyTarget | null {
  if (typeof window !== "undefined") {
    return window as unknown as KeyTarget;
  }
  return null;
}

/** Pick the default gamepad source without throwing in non-DOM environments. */
function defaultGamepadSource(): GamepadSource | null {
  if (typeof navigator === "undefined") return null;
  if (typeof navigator.getGamepads !== "function") return null;
  return () => {
    try {
      return navigator.getGamepads();
    } catch {
      // Some browsers throw when the page is not focused. Treat as no pads.
      return [];
    }
  };
}

/**
 * Build an input manager. Subscribes to keyboard + (optional) gamepad
 * sources eagerly; call `dispose()` when the race ends.
 */
export function createInputManager(options: InputManagerOptions = {}): InputManager {
  const bindings = options.bindings ?? DEFAULT_KEY_BINDINGS;
  const keyTarget = options.keyTarget === undefined ? defaultKeyTarget() : options.keyTarget;
  const gamepadSource =
    options.gamepadSource === undefined ? defaultGamepadSource() : options.gamepadSource;
  const keyToActions = buildKeyToActions(bindings);
  const heldActions = new Set<Action>();
  let disposed = false;
  let lastPadConnected = false;

  function tokenize(ev: KeyboardEvent): string[] {
    const tokens: string[] = [];
    if (ev.code) tokens.push(ev.code);
    if (ev.key) tokens.push(ev.key);
    return tokens;
  }

  function applyKeyDown(ev: KeyboardEvent): void {
    if (disposed) return;
    for (const token of tokenize(ev)) {
      const actions = keyToActions.get(token);
      if (!actions) continue;
      for (const action of actions) heldActions.add(action);
    }
  }

  function applyKeyUp(ev: KeyboardEvent): void {
    if (disposed) return;
    for (const token of tokenize(ev)) {
      const actions = keyToActions.get(token);
      if (!actions) continue;
      for (const action of actions) heldActions.delete(action);
    }
  }

  function clearHeld(): void {
    heldActions.clear();
  }

  // Wrap typed handlers in the union shape `KeyTarget` accepts. The
  // wrappers are stable references so removeEventListener works.
  const onKeyDown = (ev: KeyboardEvent | Event): void => {
    applyKeyDown(ev as KeyboardEvent);
  };
  const onKeyUp = (ev: KeyboardEvent | Event): void => {
    applyKeyUp(ev as KeyboardEvent);
  };
  const onBlur = (): void => {
    // §19 edge case: tab loses focus. Clear all held keys so no stuck
    // throttle / steer when focus returns. Gamepad state is re-polled on
    // next sample, so it self-heals.
    clearHeld();
  };

  if (keyTarget) {
    keyTarget.addEventListener("keydown", onKeyDown);
    keyTarget.addEventListener("keyup", onKeyUp);
    keyTarget.addEventListener("blur", onBlur);
  }

  function readGamepad(): Input {
    if (!gamepadSource) {
      lastPadConnected = false;
      return { ...NEUTRAL_INPUT };
    }
    let snapshot: ReadonlyArray<Gamepad | null>;
    try {
      snapshot = gamepadSource();
    } catch {
      lastPadConnected = false;
      return { ...NEUTRAL_INPUT };
    }
    // Use the first connected pad. Multi-pad couch play is out of scope.
    for (const pad of snapshot) {
      if (pad && pad.connected) {
        lastPadConnected = true;
        return inputFromGamepad(pad);
      }
    }
    lastPadConnected = false;
    return { ...NEUTRAL_INPUT };
  }

  function sample(): Input {
    const keyboard = inputFromActions(heldActions);
    const pad = readGamepad();
    return mergeInputs(keyboard, pad);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (keyTarget) {
      keyTarget.removeEventListener("keydown", onKeyDown);
      keyTarget.removeEventListener("keyup", onKeyUp);
      keyTarget.removeEventListener("blur", onBlur);
    }
    heldActions.clear();
  }

  function hasGamepad(): boolean {
    return lastPadConnected;
  }

  return { sample, dispose, hasGamepad };
}
