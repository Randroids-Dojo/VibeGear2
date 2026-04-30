import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  usePauseActions,
  type UsePauseActionsOptions,
  type UsePauseActionsResult,
} from "../usePauseActions";

/**
 * Hook tests for `usePauseActions` per dot
 * `VibeGear2-implement-restart-retire-888c712b`.
 *
 * The repo does not depend on `@testing-library/react`; the existing
 * pattern (see `src/app/__tests__/page.test.tsx`) is to render via
 * `renderToStaticMarkup` and inspect the rendered tree. The hook's
 * surface is just `useCallback` / `useMemo`, so a single render with a
 * capture component is enough to extract the wrapped handlers and
 * assert their side effects.
 */
function captureActions(
  options: UsePauseActionsOptions,
): UsePauseActionsResult {
  let captured: UsePauseActionsResult | null = null;
  function Capture(): ReactElement | null {
    captured = usePauseActions(options);
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  if (!captured) throw new Error("Capture component did not run");
  return captured;
}

describe("usePauseActions", () => {
  it("onResume only closes the menu", () => {
    const closeMenu = vi.fn();
    const onRestartImpl = vi.fn();
    const result = captureActions({ closeMenu, onRestartImpl });
    result.onResume();
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(onRestartImpl).not.toHaveBeenCalled();
  });

  it("onRestart closes the menu then invokes the restart impl", () => {
    const closeMenu = vi.fn();
    const onRestartImpl = vi.fn();
    const result = captureActions({ closeMenu, onRestartImpl });
    result.onRestart?.();
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(onRestartImpl).toHaveBeenCalledTimes(1);
    expect(closeMenu.mock.invocationCallOrder[0]).toBeLessThan(
      onRestartImpl.mock.invocationCallOrder[0]!,
    );
  });

  it("onRetire closes the menu then invokes the retire impl", () => {
    const closeMenu = vi.fn();
    const onRetireImpl = vi.fn();
    const result = captureActions({ closeMenu, onRetireImpl });
    result.onRetire?.();
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(onRetireImpl).toHaveBeenCalledTimes(1);
    expect(closeMenu.mock.invocationCallOrder[0]).toBeLessThan(
      onRetireImpl.mock.invocationCallOrder[0]!,
    );
  });

  it("onExitToTitle closes the menu then invokes the exit impl", () => {
    const closeMenu = vi.fn();
    const onExitToTitleImpl = vi.fn();
    const result = captureActions({ closeMenu, onExitToTitleImpl });
    result.onExitToTitle?.();
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(onExitToTitleImpl).toHaveBeenCalledTimes(1);
    expect(closeMenu.mock.invocationCallOrder[0]).toBeLessThan(
      onExitToTitleImpl.mock.invocationCallOrder[0]!,
    );
  });

  it("onSettings closes the menu then invokes the settings impl", () => {
    const closeMenu = vi.fn();
    const onSettingsImpl = vi.fn();
    const result = captureActions({ closeMenu, onSettingsImpl });
    result.onSettings?.();
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(onSettingsImpl).toHaveBeenCalledTimes(1);
    expect(closeMenu.mock.invocationCallOrder[0]).toBeLessThan(
      onSettingsImpl.mock.invocationCallOrder[0]!,
    );
  });

  it("onGhosts closes the menu then invokes the ghosts impl", () => {
    const closeMenu = vi.fn();
    const onGhostsImpl = vi.fn();
    const result = captureActions({ closeMenu, onGhostsImpl });
    result.onGhosts?.();
    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(onGhostsImpl).toHaveBeenCalledTimes(1);
    expect(closeMenu.mock.invocationCallOrder[0]).toBeLessThan(
      onGhostsImpl.mock.invocationCallOrder[0]!,
    );
  });

  it("returns undefined for any handler whose impl is null so PauseOverlay disables the button", () => {
    const closeMenu = vi.fn();
    const result = captureActions({
      closeMenu,
      onRestartImpl: null,
      onRetireImpl: null,
      onExitToTitleImpl: null,
      onSettingsImpl: null,
      onGhostsImpl: null,
    });
    expect(result.onRestart).toBeUndefined();
    expect(result.onRetire).toBeUndefined();
    expect(result.onExitToTitle).toBeUndefined();
    expect(result.onSettings).toBeUndefined();
    expect(result.onGhosts).toBeUndefined();
    // onResume is always provided.
    expect(typeof result.onResume).toBe("function");
  });

  it("treats omitted impl props the same as null (button disabled)", () => {
    const closeMenu = vi.fn();
    const result = captureActions({ closeMenu });
    expect(result.onRestart).toBeUndefined();
    expect(result.onRetire).toBeUndefined();
    expect(result.onExitToTitle).toBeUndefined();
    expect(result.onSettings).toBeUndefined();
    expect(result.onGhosts).toBeUndefined();
  });
});
