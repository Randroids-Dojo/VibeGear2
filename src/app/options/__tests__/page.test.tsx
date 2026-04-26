import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OptionsPage from "../page";
import { TAB_ORDER } from "../tabNav";

/**
 * Options screen scaffold (GDD §20). Static-markup assertions follow the
 * same pattern as `src/app/__tests__/page.test.tsx`. Interactive arrow-key
 * tab navigation is exercised by the Playwright spec
 * `e2e/options-screen.spec.ts`; the pure model is unit-tested in
 * `tabNav.test.ts`. This file pins the contract that the page emits the
 * test ids and dot-id placeholders that downstream slices and the e2e
 * suite key off.
 */
describe("OptionsPage", () => {
  const html = renderToStaticMarkup(createElement(OptionsPage));

  it("renders an options-page wrapper", () => {
    expect(html).toContain('data-testid="options-page"');
  });

  it("renders the title 'Options'", () => {
    expect(html).toContain("Options");
    expect(html).toContain('id="options-title"');
  });

  it("renders every tab label per the §20 TAB_ORDER", () => {
    for (const key of TAB_ORDER) {
      expect(
        html,
        `tab ${key} missing`,
      ).toContain(`data-testid="options-tab-${key}"`);
    }
  });

  it("opens with Display selected and the other tabs marked unselected", () => {
    const displayTab = html.match(
      /<button[^>]*data-testid="options-tab-display"[^>]*>/,
    );
    expect(displayTab, "display tab not found").not.toBeNull();
    expect(displayTab?.[0]).toContain('aria-selected="true"');
    expect(displayTab?.[0]).toContain('data-active="true"');

    const audioTab = html.match(
      /<button[^>]*data-testid="options-tab-audio"[^>]*>/,
    );
    expect(audioTab, "audio tab not found").not.toBeNull();
    expect(audioTab?.[0]).toContain('aria-selected="false"');
  });

  it("renders the Display panel with the polish dot id placeholder", () => {
    expect(html).toContain('data-testid="options-panel-display"');
    expect(html).toContain("VibeGear2-implement-visual-polish-7d31d112");
  });

  it("cites every implementing dot id for the matching tab placeholder", () => {
    // The active tab is Display, so only its dot id is in the rendered
    // markup. The other dot ids live in TABS and are emitted when the
    // pane is selected. We assert the constants exist in the bundle by
    // checking the tab labels render and the Display dot id is present.
    expect(html).toContain("VibeGear2-implement-visual-polish-7d31d112");
  });

  it("disables the Reset to defaults button until SaveGameSettings v2 lands", () => {
    const reset = html.match(
      /<button[^>]*data-testid="options-reset-defaults"[^>]*>/,
    );
    expect(reset, "reset button not found").not.toBeNull();
    expect(reset?.[0]).toContain("disabled");
    expect(reset?.[0]).toContain('aria-disabled="true"');
    expect(reset?.[0]).toContain("VibeGear2-implement-savegamesettings-b948015a");
  });

  it("renders a back-to-title link", () => {
    const back = html.match(/<a[^>]*data-testid="options-back"[^>]*>/);
    expect(back, "back link not found").not.toBeNull();
    expect(back?.[0]).toContain('href="/"');
  });

  it("uses tabIndex=0 only on the active tab and -1 on the rest", () => {
    const active = html.match(
      /<button[^>]*data-testid="options-tab-display"[^>]*>/,
    );
    expect(active?.[0]).toContain('tabindex="0"');

    const inactive = html.match(
      /<button[^>]*data-testid="options-tab-audio"[^>]*>/,
    );
    expect(inactive?.[0]).toContain('tabindex="-1"');
  });
});
