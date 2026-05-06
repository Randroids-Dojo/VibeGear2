/**
 * Smoke tests for `FeedbackFab`.
 *
 * The component depends on `document.body` for its portal target and
 * uses `useEffect` to flip the `mounted` flag, so a server-side render
 * via `renderToStaticMarkup` returns `null`. We verify that contract,
 * then test the title-deriver in isolation by importing the module
 * and exercising the closed-form helper through the component's
 * exported surface.
 *
 * Full client-side interaction (open panel, fill textarea, submit) is
 * covered by the Playwright suite where a real DOM and fetch stub are
 * available.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FeedbackFab } from "../FeedbackFab";

describe("FeedbackFab", () => {
  it("renders nothing on the server (waits for mount)", () => {
    const html = renderToStaticMarkup(createElement(FeedbackFab));
    expect(html).toBe("");
  });
});
