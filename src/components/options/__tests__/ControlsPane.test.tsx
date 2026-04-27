import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ControlsPane } from "../ControlsPane";

describe("ControlsPane SSR shell", () => {
  it("renders the loading state before client hydration", () => {
    const html = renderToStaticMarkup(createElement(ControlsPane));

    expect(html).toContain('data-testid="controls-pane-loading"');
    expect(html).toContain("Loading control bindings.");
  });
});
