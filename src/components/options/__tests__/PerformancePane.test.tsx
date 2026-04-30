import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PerformancePane } from "../PerformancePane";

describe("PerformancePane SSR shell", () => {
  it("renders the loading state before client hydration", () => {
    const html = renderToStaticMarkup(createElement(PerformancePane));

    expect(html).toContain('data-testid="performance-pane-loading"');
    expect(html).toContain("Loading performance settings.");
  });
});
