import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DifficultyPane } from "../DifficultyPane";

/**
 * SSR-shape contract for `DifficultyPane`. Because the pane hydrates from
 * `loadSave()` inside `useEffect`, the static-markup render reflects the
 * pre-hydration loading state. The interactive flows (radio selection
 * persists, locked Master tile, detail panel updates) are exercised in
 * the matching Playwright spec `e2e/options-difficulty.spec.ts`. The pure
 * model has dedicated coverage in `difficultyPaneState.test.ts`.
 */
describe("DifficultyPane SSR shell", () => {
  const html = renderToStaticMarkup(createElement(DifficultyPane));

  it("renders the loading marker before hydration", () => {
    expect(html).toContain('data-testid="difficulty-pane-loading"');
  });

  it("never includes an em-dash in rendered copy (project rule)", () => {
    expect(html).not.toMatch(/[–—]/u);
  });
});
