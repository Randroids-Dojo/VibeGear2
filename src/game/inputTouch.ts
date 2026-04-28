/**
 * Touch / mobile input source.
 *
 * Source of truth: `docs/gdd/19-controls-and-input.md` "Touch and mobile
 * future work". Closes F-013 in `docs/FOLLOWUPS.md`.
 *
 * The control surface is two zones split down the canvas mid-line:
 * - Left zone: a virtual analog stick. The first pointerdown anchors the
 *   stick neutral position; subsequent moves of that pointer are read as
 *   an offset clamped to a configurable max radius and normalised into
 *   `[-1, 1]` along the X axis. Y axis offset is ignored for now (steer
 *   only). Lifting the finger releases the stick.
 * - Right zone: discrete touch buttons in the lower-right thumb arc.
 *   Accelerator and brake are circular hit targets near the natural
 *   phone grip position. Nitro and pause stay on the top-right edge.
 *
 * Multi-touch is required so a player can hold accelerator with one
 * finger and steer with another. The stateful manager tracks each
 * pointer by its `pointerId` and routes it to whichever zone its initial
 * down position fell into.
 *
 * The pure helper `inputFromTouchState` is environment-free and is the
 * core of the unit tests: feed it a snapshot of pointer positions and
 * the layout rect, get back the canonical `Input`. The stateful
 * `createTouchInputSource` is a thin shell that maintains the
 * pointer-tracking state and subscribes to a target's pointer events.
 *
 * The new source plugs into `mergeInputs` exactly like keyboard and
 * gamepad: per the merge rules in `input.ts`, when both keyboard and
 * touch produce non-zero steer the larger absolute value wins; booleans
 * OR. Touch coexists with keyboard so a touchscreen laptop can mix.
 */

import type { Input } from "./input";
import { NEUTRAL_INPUT } from "./input";

/**
 * Layout rectangle for the touch surface. All values are in CSS pixels
 * relative to the touch target's `getBoundingClientRect()`. The pure
 * helper takes this as input so tests do not need a real DOM.
 *
 * - `width` / `height`: full surface bounds.
 * - `steerZoneRatio`: left fraction of the surface that counts as the
 *   steering zone. Default 0.5 splits the screen down the middle.
 * - `stickMaxRadius`: pointer offset (in CSS pixels) at which the stick
 *   reads as +/-1. Larger values reduce sensitivity.
 * - `nitroCornerSize`: side length of the top-right nitro tap target.
 * - `pauseCornerSize`: side length of the top-right pause tap target.
 *   Pause sits inboard of nitro so a thumb reach to the corner does not
 *   accidentally pause the race.
 * - `brakeFraction`: retained for older layout callers. The current
 *   lower-right button classifier uses derived circular hit targets.
 */
export interface TouchLayout {
  width: number;
  height: number;
  steerZoneRatio: number;
  stickMaxRadius: number;
  nitroCornerSize: number;
  pauseCornerSize: number;
  brakeFraction: number;
}

export const DEFAULT_TOUCH_LAYOUT: Readonly<TouchLayout> = Object.freeze({
  width: 800,
  height: 480,
  steerZoneRatio: 0.5,
  stickMaxRadius: 100,
  nitroCornerSize: 96,
  pauseCornerSize: 80,
  brakeFraction: 0.4,
});

/**
 * Snapshot of one tracked pointer at a moment in time. The pure helper
 * accepts a list of these and the layout, and emits an `Input`.
 *
 * `originX` / `originY` is the position the pointer first went down at
 * (the stick's anchor for steering pointers). `currentX` / `currentY`
 * is the latest reported position. For pure button taps the two are
 * usually equal; for stick drags they diverge.
 */
export interface TouchPointer {
  id: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

/**
 * Snapshot of all currently-down pointers plus the layout they were
 * captured under. Pure input to `inputFromTouchState`.
 */
export interface TouchState {
  pointers: ReadonlyArray<TouchPointer>;
  layout: TouchLayout;
}

interface ZoneClassification {
  steer: TouchPointer | null;
  accelerate: boolean;
  brake: boolean;
  nitro: boolean;
  pause: boolean;
}

function thumbButtonRadius(layout: TouchLayout): number {
  return Math.max(52, Math.min(88, layout.width * 0.14));
}

function isInsideCircle(
  p: TouchPointer,
  centerX: number,
  centerY: number,
  radius: number,
): boolean {
  const dx = p.originX - centerX;
  const dy = p.originY - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Classify a pointer's origin into the layout zones. The zones are
 * computed off the origin position, not the current position, so a drag
 * that strays out of the steering zone still reads as a steer.
 *
 * Two pointers in the same zone resolve per the dot's edge-case rules:
 * - Steering: latest pointer wins (so re-anchoring with a fresh finger
 *   takes effect immediately).
 * - Accelerate / brake: any pointer in the zone counts as held, so the
 *   player can lift and replace fingers without losing throttle.
 */
function classifyPointers(state: TouchState): ZoneClassification {
  const { layout } = state;
  const steerZoneMaxX = layout.width * layout.steerZoneRatio;
  const nitroMinX = layout.width - layout.nitroCornerSize;
  const nitroMaxY = layout.nitroCornerSize;
  // Pause sits inboard of nitro on the top edge: it lives just to the
  // left of the nitro corner, same vertical band.
  const pauseMaxX = nitroMinX;
  const pauseMinX = pauseMaxX - layout.pauseCornerSize;
  const pauseMaxY = layout.pauseCornerSize;
  const buttonRadius = thumbButtonRadius(layout);
  const accelCenterX = layout.width * 0.86;
  const accelCenterY = layout.height * 0.72;
  const brakeCenterX = layout.width * 0.68;
  const brakeCenterY = layout.height * 0.82;

  let steer: TouchPointer | null = null;
  let accelerate = false;
  let brake = false;
  let nitro = false;
  let pause = false;

  for (const p of state.pointers) {
    if (p.originX < steerZoneMaxX) {
      // Latest steering pointer wins. The pointers list is iterated in
      // insertion order so the last classified one wins by overwrite.
      steer = p;
      continue;
    }

    // Right zone. Check corner buttons first so accidental overlap with
    // accelerator does not steal a nitro press.
    if (
      p.originX >= nitroMinX &&
      p.originX < layout.width &&
      p.originY >= 0 &&
      p.originY < nitroMaxY
    ) {
      nitro = true;
      continue;
    }
    if (
      p.originX >= pauseMinX &&
      p.originX < pauseMaxX &&
      p.originY >= 0 &&
      p.originY < pauseMaxY
    ) {
      pause = true;
      continue;
    }
    if (isInsideCircle(p, accelCenterX, accelCenterY, buttonRadius)) {
      accelerate = true;
    } else if (isInsideCircle(p, brakeCenterX, brakeCenterY, buttonRadius * 0.95)) {
      brake = true;
    }
  }

  return { steer, accelerate, brake, nitro, pause };
}

function computeSteer(stickPointer: TouchPointer | null, layout: TouchLayout): number {
  if (!stickPointer) return 0;
  const dx = stickPointer.currentX - stickPointer.originX;
  if (!Number.isFinite(dx)) return 0;
  const radius = layout.stickMaxRadius > 0 ? layout.stickMaxRadius : 1;
  const normalised = dx / radius;
  if (normalised > 1) return 1;
  if (normalised < -1) return -1;
  return normalised;
}

/**
 * Pure helper: project a touch state snapshot onto the canonical
 * `Input` shape. Environment-free; tests feed in synthetic pointer
 * arrays and assert the resulting `Input` directly.
 *
 * Steering applies the layout's `stickMaxRadius` and clamps to
 * `[-1, 1]`. Accelerator / brake / nitro / pause are digital (0 or 1).
 * Handbrake and gear shifts are not bound to a touch zone in this
 * slice; future work can extend the layout if needed.
 */
export function inputFromTouchState(state: TouchState): Input {
  if (state.pointers.length === 0) return { ...NEUTRAL_INPUT };
  const zones = classifyPointers(state);
  return {
    steer: computeSteer(zones.steer, state.layout),
    throttle: zones.accelerate ? 1 : 0,
    brake: zones.brake ? 1 : 0,
    nitro: zones.nitro,
    handbrake: false,
    pause: zones.pause,
    shiftUp: false,
    shiftDown: false,
  };
}

// Stateful manager ---------------------------------------------------------

/**
 * Subset of the DOM `EventTarget` and `Element.getBoundingClientRect`
 * that the stateful manager needs. Tests pass a stub so no real DOM is
 * required.
 */
export interface TouchTarget {
  addEventListener(
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel" | "blur",
    listener: (ev: Event) => void,
  ): void;
  removeEventListener(
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel" | "blur",
    listener: (ev: Event) => void,
  ): void;
  getBoundingClientRect(): DOMRect | { left: number; top: number; width: number; height: number };
}

/**
 * Layout source. Defaults to a function that derives width / height
 * from the target's bounding rect and uses `DEFAULT_TOUCH_LAYOUT` for
 * the rest of the fields. Callers can pass a constant or a function
 * that reads from settings.
 */
export type TouchLayoutSource = () => TouchLayout;

export interface TouchInputSourceOptions {
  /** Element to subscribe to. Defaults to `globalThis.window` when present. */
  target?: TouchTarget | null;
  /** Layout supplier. Recomputed per `sample()` so resize is picked up. */
  layout?: TouchLayoutSource;
  /**
   * Optional blur-like reset signal. Defaults to listening for the
   * target's `blur` event, mirroring the keyboard manager's behaviour.
   * When the window loses focus all active pointers are cleared so a
   * stuck finger never persists across tab switches.
   */
  resetOnBlur?: boolean;
}

export interface TouchInputSource {
  /** Snapshot the current touch state as an `Input`. Cheap; safe per tick. */
  sample: () => Input;
  /** True if any pointer is currently down. Diagnostic only. */
  hasActivePointers: () => boolean;
  /** Drop event listeners and active pointers. Idempotent. */
  dispose: () => void;
}

/**
 * Read fields from a `PointerEvent` without depending on the DOM type
 * being globally available in the test environment.
 */
interface PointerLike {
  pointerId: number;
  clientX: number;
  clientY: number;
  preventDefault?: () => void;
}

function defaultTarget(): TouchTarget | null {
  if (typeof window === "undefined") return null;
  return window as unknown as TouchTarget;
}

function defaultLayoutFor(target: TouchTarget | null): TouchLayoutSource {
  return () => {
    if (!target) return { ...DEFAULT_TOUCH_LAYOUT };
    const rect = target.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : DEFAULT_TOUCH_LAYOUT.width;
    const height = rect.height > 0 ? rect.height : DEFAULT_TOUCH_LAYOUT.height;
    return { ...DEFAULT_TOUCH_LAYOUT, width, height };
  };
}

/**
 * Convert a `PointerEvent.clientX/Y` into target-local coordinates
 * using the latest bounding rect. Keeping this as a small helper makes
 * the manager testable: the test stub returns whatever rect the test
 * configures.
 */
function localCoords(target: TouchTarget | null, event: PointerLike): { x: number; y: number } {
  if (!target) return { x: event.clientX, y: event.clientY };
  const rect = target.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/**
 * Build a stateful touch input source. Subscribes to the target's
 * pointer events on creation; call `dispose()` when the race ends to
 * detach listeners.
 *
 * The manager is intentionally minimal: it tracks each pointer by id,
 * remembers its origin position so the steering stick has an anchor,
 * and updates `currentX` / `currentY` on every move. `sample()` runs
 * the pure helper against the current state.
 */
export function createTouchInputSource(options: TouchInputSourceOptions = {}): TouchInputSource {
  const target = options.target === undefined ? defaultTarget() : options.target;
  const layoutSource = options.layout ?? defaultLayoutFor(target);
  const resetOnBlur = options.resetOnBlur ?? true;
  const pointers = new Map<number, TouchPointer>();
  let disposed = false;

  function upsertPointer(event: PointerLike, isDown: boolean): void {
    if (disposed) return;
    const { x, y } = localCoords(target, event);
    if (isDown || !pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, {
        id: event.pointerId,
        originX: x,
        originY: y,
        currentX: x,
        currentY: y,
      });
      return;
    }
    const existing = pointers.get(event.pointerId);
    if (!existing) return;
    pointers.set(event.pointerId, {
      ...existing,
      currentX: x,
      currentY: y,
    });
  }

  function releasePointer(event: PointerLike): void {
    if (disposed) return;
    pointers.delete(event.pointerId);
  }

  function clearAll(): void {
    pointers.clear();
  }

  const onPointerDown = (ev: Event): void => {
    const ple = ev as unknown as PointerLike;
    ple.preventDefault?.();
    upsertPointer(ple, true);
  };
  const onPointerMove = (ev: Event): void => {
    const ple = ev as unknown as PointerLike;
    if (!pointers.has(ple.pointerId)) return;
    ple.preventDefault?.();
    upsertPointer(ple, false);
  };
  const onPointerUp = (ev: Event): void => {
    const ple = ev as unknown as PointerLike;
    ple.preventDefault?.();
    releasePointer(ple);
  };
  const onPointerCancel = (ev: Event): void => {
    // Cancellation = the system stole the pointer (gesture, palm reject,
    // OS modal). Release it as if the finger lifted so the manager does
    // not hold a phantom stick.
    const ple = ev as unknown as PointerLike;
    ple.preventDefault?.();
    releasePointer(ple);
  };
  const onBlur = (): void => {
    clearAll();
  };

  if (target) {
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("pointermove", onPointerMove);
    target.addEventListener("pointerup", onPointerUp);
    target.addEventListener("pointercancel", onPointerCancel);
    if (resetOnBlur) target.addEventListener("blur", onBlur);
  }

  function sample(): Input {
    const layout = layoutSource();
    return inputFromTouchState({ pointers: Array.from(pointers.values()), layout });
  }

  function hasActivePointers(): boolean {
    return pointers.size > 0;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (target) {
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("pointercancel", onPointerCancel);
      if (resetOnBlur) target.removeEventListener("blur", onBlur);
    }
    pointers.clear();
  }

  return { sample, hasActivePointers, dispose };
}
