import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TitlePage from "../page";

/**
 * Title-screen menu wiring (GDD §5, §20). Asserts the three menu items
 * render with the expected hrefs (or pending state for Options) and
 * keep the data-testid hooks the e2e smoke spec depends on.
 *
 * We render to static markup rather than mount in jsdom + RTL because
 * the page is a Server Component returning plain JSX, and the rest of
 * the suite is plain ts/tsx without an RTL dependency. Using
 * `createElement` keeps this file off the JSX transform path so the
 * existing vitest config (no `@vitejs/plugin-react` wired in) handles
 * it without further configuration.
 */
describe("TitlePage", () => {
  const html = renderToStaticMarkup(createElement(TitlePage));

  it("renders the game title", () => {
    expect(html).toContain('data-testid="game-title"');
    expect(html).toContain("VibeGear2");
  });

  it("renders Start Race as an anchor pointing at /race", () => {
    const match = html.match(
      /<a[^>]*data-testid="menu-start-race"[^>]*>/,
    );
    expect(match, "menu-start-race anchor not found").not.toBeNull();
    expect(match?.[0]).toContain('href="/race"');
  });

  it("renders Garage as an anchor pointing at /garage/cars", () => {
    const match = html.match(/<a[^>]*data-testid="menu-garage"[^>]*>/);
    expect(match, "menu-garage anchor not found").not.toBeNull();
    expect(match?.[0]).toContain('href="/garage/cars"');
  });

  it("renders Options as a disabled button until /options lands", () => {
    const match = html.match(
      /<button[^>]*data-testid="menu-options-pending"[^>]*>/,
    );
    expect(match, "menu-options-pending button not found").not.toBeNull();
    expect(match?.[0]).toContain("disabled");
    expect(match?.[0]).toContain('aria-disabled="true"');
  });

  it("places Start Race before Garage before Options in tab order", () => {
    const startIdx = html.indexOf('data-testid="menu-start-race"');
    const garageIdx = html.indexOf('data-testid="menu-garage"');
    const optionsIdx = html.indexOf('data-testid="menu-options-pending"');
    expect(startIdx).toBeGreaterThan(-1);
    expect(garageIdx).toBeGreaterThan(startIdx);
    expect(optionsIdx).toBeGreaterThan(garageIdx);
  });

  it("keeps the build-status footer hook", () => {
    expect(html).toContain('data-testid="build-status"');
    expect(html).toContain("Phase 0");
  });
});
