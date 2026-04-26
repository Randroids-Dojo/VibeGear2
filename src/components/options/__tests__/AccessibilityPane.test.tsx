import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AccessibilityPane } from "../AccessibilityPane";

/**
 * SSR-shape contract for `AccessibilityPane`. Because the pane hydrates
 * from `loadSave()` inside `useEffect`, the static-markup render
 * reflects the pre-hydration loading state. The interactive flows
 * (toggle persists, status surfaces) are exercised in
 * `e2e/options-accessibility.spec.ts`. The pure model has dedicated
 * coverage in `accessibilityPaneState.test.ts`.
 */
describe("AccessibilityPane SSR shell", () => {
  const html = renderToStaticMarkup(createElement(AccessibilityPane));

  it("renders the loading marker before hydration", () => {
    expect(html).toContain('data-testid="accessibility-pane-loading"');
  });

  it("never includes an em-dash in rendered copy (project rule)", () => {
    expect(html).not.toMatch(/[–—]/u);
  });
});
