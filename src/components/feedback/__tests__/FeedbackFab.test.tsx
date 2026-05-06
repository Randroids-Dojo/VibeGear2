/**
 * Smoke tests for `FeedbackFab`.
 *
 * The component depends on `document.body` for its portal target and
 * uses `useEffect` to flip the `mounted` flag, so a server-side render
 * via `renderToStaticMarkup` returns the empty server shell. We pin
 * that contract here.
 *
 * Full client-side interaction (open panel, fill textarea, submit,
 * click-outside dismiss, Escape dismiss) is intentionally out of scope
 * for this unit suite and is tracked by F-077 as a future Playwright
 * spec. The repo has no `@testing-library/react` dependency yet, so
 * exercising the rendered DOM here would mean adding one for a single
 * file. Until F-077 lands, the route-handler suite plus the in-browser
 * smoke against a Preview deploy guard the contract.
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
