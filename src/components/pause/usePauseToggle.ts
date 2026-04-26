"use client";

/**
 * Hook that listens for the configured pause action key and toggles a
 * boolean open state. Designed to sit alongside `<PauseOverlay open />`
 * in the race scene: the same hook that flips the overlay's `open` flag
 * also pauses the underlying loop via the optional `loop` callback.
 *
 * Binding source: `resolvePauseTokens()` in `./pauseAction`. The current
 * default is `Escape` per `docs/gdd/19-controls-and-input.md`. When F-014
 * lands the per-save bindings UI, the helper will read the save without
 * any change to this hook.
 *
 * Edge cases (matches the dot's "Edge Cases" list):
 * - Multiple pause requests in one frame: keydown listener checks
 *   `event.repeat` so a held key produces a single toggle per press.
 * - Window blur while paused: the listener does not auto-resume on focus
 *   return; the overlay stays open until the user dismisses it.
 */

import { useCallback, useEffect, useState } from "react";

import type { LoopHandle } from "@/game/loop";

import { isPauseEvent, resolvePauseTokens } from "./pauseAction";

export interface UsePauseToggleOptions {
  /**
   * Optional loop handle, or a getter that returns one. When supplied,
   * the hook calls `pause()` / `resume()` on the same edge that flips
   * the open state. A getter form is useful when the caller stores the
   * loop in a ref that is null until first effect (dev pages do this).
   */
  loop?: LoopHandle | (() => LoopHandle | null) | null;
  /**
   * Override the keyboard target. Defaults to `globalThis.window`. Tests
   * pass an `EventTarget` so no DOM is required.
   */
  target?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  /** Override the resolved pause tokens. Defaults to `resolvePauseTokens()`. */
  tokens?: readonly string[];
}

export interface UsePauseToggleResult {
  open: boolean;
  /** Imperatively open the overlay (e.g. from a HUD button). */
  openMenu: () => void;
  /** Imperatively close the overlay (e.g. from the resume button). */
  closeMenu: () => void;
  /** Toggle the overlay. Used by the keyboard binding. */
  toggle: () => void;
}

function defaultTarget(): Pick<Window, "addEventListener" | "removeEventListener"> | null {
  if (typeof window === "undefined") return null;
  return window;
}

export function usePauseToggle(options: UsePauseToggleOptions = {}): UsePauseToggleResult {
  const [open, setOpen] = useState(false);
  const tokens = options.tokens ?? resolvePauseTokens();
  const target = options.target === undefined ? defaultTarget() : options.target;

  const resolveLoop = (): LoopHandle | null => {
    const loop = options.loop;
    if (loop === null || loop === undefined) return null;
    if (typeof loop === "function") return loop();
    return loop;
  };

  const closeMenu = useCallback(() => {
    setOpen((prev) => {
      if (!prev) return prev;
      resolveLoop()?.resume();
      return false;
    });
    // resolveLoop reads from options each call; including options here
    // would re-create the callback every render for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openMenu = useCallback(() => {
    setOpen((prev) => {
      if (prev) return prev;
      resolveLoop()?.pause();
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) {
        resolveLoop()?.resume();
        return false;
      }
      resolveLoop()?.pause();
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!target) return;
    const listener = (event: Event): void => {
      if (!isPauseEvent(event as KeyboardEvent, tokens)) return;
      // Stop the default Escape behaviour (e.g. exiting fullscreen) so
      // the overlay is the sole consumer of the pause press.
      (event as KeyboardEvent).preventDefault?.();
      toggle();
    };
    target.addEventListener("keydown", listener as EventListener);
    return () => {
      target.removeEventListener("keydown", listener as EventListener);
    };
  }, [target, tokens, toggle]);

  return { open, openMenu, closeMenu, toggle };
}
