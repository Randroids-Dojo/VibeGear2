/**
 * Pure tab-navigation helper for the Options screen (GDD §20 Settings).
 *
 * Owns the keyboard model that the page UI binds to:
 *   ArrowLeft  -> previous tab (wraps to last)
 *   ArrowRight -> next tab (wraps to first)
 *   Home       -> first tab
 *   End        -> last tab
 *
 * Lives separately from `page.tsx` so the model is unit-testable without
 * jsdom or React Testing Library, matching the project's test style. The
 * page wraps `nextTabIndex` in a `useCallback` and forwards keydown
 * events to it. The set of tabs is provided by the caller so that as
 * later slices replace placeholder panes with real settings panes the
 * navigation order can be re-ordered without editing this file.
 */

export type TabKey =
  | "display"
  | "audio"
  | "controls"
  | "accessibility"
  | "difficulty"
  | "performance";

/** Stable left-to-right tab order shown in the options chrome. */
export const TAB_ORDER: ReadonlyArray<TabKey> = [
  "display",
  "audio",
  "controls",
  "accessibility",
  "difficulty",
  "performance",
];

/**
 * Returns the next tab index given a keyboard key. Returns the same
 * index when the key is not a tab-navigation key, so the caller can
 * compare for change before issuing a state update.
 */
export function nextTabIndex(
  current: number,
  key: string,
  total: number,
): number {
  if (total <= 0) return 0;
  const wrap = (idx: number): number => ((idx % total) + total) % total;
  switch (key) {
    case "ArrowLeft":
      return wrap(current - 1);
    case "ArrowRight":
      return wrap(current + 1);
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return current;
  }
}

/** True when `key` is one of the navigation keys this helper handles. */
export function isTabNavKey(key: string): boolean {
  return (
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "Home" ||
    key === "End"
  );
}
