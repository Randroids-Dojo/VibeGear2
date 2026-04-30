"use client";

/**
 * Hook that wraps the five wired §20 pause-menu actions per dot
 * `VibeGear2-implement-restart-retire-888c712b`.
 *
 * `<PauseOverlay />` accepts `onResume`, `onRestart`, `onRetire`,
 * `onSettings`, `onLeaderboard`, `onExitToTitle`. The race route used to
 * supply only `onResume` (the other three were left undefined so the
 * buttons rendered disabled). This hook is the single binding the race /
 * quick-race / time-trial / practice surfaces all reuse so the wiring
 * does not drift across pages.
 *
 * Why pass imperative callbacks rather than the session ref directly?
 * The session is held in a `useRef` inside the page component (the loop
 * mutates it every tick); the hook stays decoupled from that ref shape
 * by accepting the small set of imperative effects each handler needs.
 * That keeps the hook testable with literal stubs and lets a future
 * page (e.g. championship retry) plug in different effects without
 * forking the hook.
 *
 * Each wrapper closes the pause menu (`closeMenu`) before invoking the
 * downstream effect. The §20 design intent is that the menu disappears
 * the moment the player commits to an action; rendering the post-action
 * UI under a still-open menu would obscure the result.
 *
 * Edge cases:
 *
 *   - Restart during countdown: the page-side `onRestartImpl` rebuilds
 *     the session from the same config so the countdown re-runs from 3.
 *   - Retire during countdown: the page-side `onRetireImpl` uses the
 *     same retire path; the session is flagged DNF and the route hops
 *     to the results screen (the screen renders DNF placement).
 *   - Exit to title while paused: `onExitToTitleImpl` disposes the
 *     loop before navigating so a torn-down rAF / audio handle cannot
 *     leak across the route hop.
 *   - Settings while paused: the parent disposes the live runtime before
 *     routing to `/options`, matching exit-to-title teardown.
 *   - Restart after finish: the parent disables the button by passing
 *     `onRestartImpl: null`; the hook surfaces `onRestart: undefined`
 *     in that case so `<PauseOverlay />`'s self-disable contract
 *     handles the rendering.
 */

import { useCallback, useMemo } from "react";

export interface UsePauseActionsOptions {
  /** Close the pause overlay. Always called first by every action. */
  closeMenu: () => void;
  /**
   * Restart the race in place. The page rebuilds the session from the
   * existing config and resumes the loop. `null` disables the button
   * (e.g. on the post-finish screen where Rematch lives on results).
   */
  onRestartImpl?: (() => void) | null;
  /**
   * Retire the race. The page flips the session to the post-retire
   * shape (player DNF, race finished) and routes to the results screen
   * with a freshly-built `RaceResult`. `null` disables the button.
   */
  onRetireImpl?: (() => void) | null;
  /**
   * Tear down the loop and route to the title screen. `null` disables
   * the button (no current surface needs that, but the hook honours it
   * for symmetry with the other two actions).
   */
  onExitToTitleImpl?: (() => void) | null;
  /**
   * Tear down the loop and route to settings. `null` disables the
   * button for surfaces that do not have a settings target.
   */
  onSettingsImpl?: (() => void) | null;
}

export interface UsePauseActionsResult {
  /** Wrapper that closes the menu only. Always provided. */
  onResume: () => void;
  /** Wrapper around `onRestartImpl`, or `undefined` when the impl is null. */
  onRestart?: () => void;
  /** Wrapper around `onRetireImpl`, or `undefined` when the impl is null. */
  onRetire?: () => void;
  /** Wrapper around `onExitToTitleImpl`, or `undefined` when the impl is null. */
  onExitToTitle?: () => void;
  /** Wrapper around `onSettingsImpl`, or `undefined` when the impl is null. */
  onSettings?: () => void;
}

/**
 * Wire the §20 pause-menu actions through `closeMenu` plus a small set
 * of imperative effects. Returns `<PauseOverlay />`-shaped props the
 * caller spreads onto the overlay.
 *
 * `useMemo` rebuilds the result only when the underlying impls swap;
 * this keeps the overlay's prop identities stable so React does not
 * tear down focus state between renders.
 */
export function usePauseActions(
  options: UsePauseActionsOptions,
): UsePauseActionsResult {
  const {
    closeMenu,
    onRestartImpl,
    onRetireImpl,
    onExitToTitleImpl,
    onSettingsImpl,
  } = options;

  const onResume = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  const onRestart = useCallback(() => {
    closeMenu();
    onRestartImpl?.();
  }, [closeMenu, onRestartImpl]);

  const onRetire = useCallback(() => {
    closeMenu();
    onRetireImpl?.();
  }, [closeMenu, onRetireImpl]);

  const onExitToTitle = useCallback(() => {
    closeMenu();
    onExitToTitleImpl?.();
  }, [closeMenu, onExitToTitleImpl]);

  const onSettings = useCallback(() => {
    closeMenu();
    onSettingsImpl?.();
  }, [closeMenu, onSettingsImpl]);

  return useMemo(
    () => ({
      onResume,
      onRestart: onRestartImpl ? onRestart : undefined,
      onRetire: onRetireImpl ? onRetire : undefined,
      onExitToTitle: onExitToTitleImpl ? onExitToTitle : undefined,
      onSettings: onSettingsImpl ? onSettings : undefined,
    }),
    [
      onResume,
      onRestart,
      onRetire,
      onExitToTitle,
      onSettings,
      onRestartImpl,
      onRetireImpl,
      onExitToTitleImpl,
      onSettingsImpl,
    ],
  );
}
