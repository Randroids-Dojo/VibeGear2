import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UpdateBanner } from "../UpdateBanner";

/**
 * SSR-shape contract for `UpdateBanner`.
 *
 * The full timer + effect flow (initial 30s delay, 60s poll, banner
 * appearance on SHA mismatch, RELOAD click reloads the window) is
 * exercised end-to-end by `e2e/update-banner.spec.ts`, where the route
 * is intercepted to return a different SHA. The pure
 * version-comparison logic is covered by
 * `checkRemoteVersion.test.ts`.
 *
 * This file pins the SSR render: a server-rendered tree never includes
 * the banner because the polling effect cannot have run yet, and the
 * dev-build short-circuit means the effect would refuse to schedule
 * even if it could. Either way, the layout must render no chrome.
 */

describe("UpdateBanner SSR shape", () => {
  it("renders nothing on first paint (effect has not run)", () => {
    const html = renderToStaticMarkup(createElement(UpdateBanner));
    expect(html).toBe("");
  });

  it("does not include the banner test id under SSR", () => {
    const html = renderToStaticMarkup(createElement(UpdateBanner));
    expect(html).not.toContain("update-banner");
  });
});
