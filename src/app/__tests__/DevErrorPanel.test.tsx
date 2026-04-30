import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DevErrorPanel } from "../DevErrorPanel";

describe("DevErrorPanel", () => {
  it("renders nothing during SSR and before the query flag is read", () => {
    const html = renderToStaticMarkup(createElement(DevErrorPanel));
    expect(html).toBe("");
  });
});
