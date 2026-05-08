import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TutorialPrepCard } from "../TutorialPrepCard";

/**
 * SSR-shape contract for the F-098 first-race tutorial card. Because
 * the card has a `useEffect`-bound key handler and a focus trap, the
 * static-markup render covers only structure: the dialog role, the
 * test-ids the prep page asserts on, and the project's no-em-dash
 * rule on rendered copy. Interactive dismiss flows (click backdrop,
 * Enter / Space / Escape, "Got it" button) are pinned by
 * `e2e/race-prep-tutorial.spec.ts` once that lands.
 */
describe("TutorialPrepCard SSR shell", () => {
  const html = renderToStaticMarkup(
    createElement(TutorialPrepCard, { onDismiss: () => {} }),
  );

  it("renders the dialog test id", () => {
    expect(html).toContain('data-testid="tutorial-prep-card"');
  });

  it("renders the dismiss button test id", () => {
    expect(html).toContain('data-testid="tutorial-prep-card-dismiss"');
  });

  it("renders the welcome heading", () => {
    expect(html).toContain("Welcome to VibeGear2");
  });

  it("names every primary input", () => {
    expect(html).toContain("Up arrow");
    expect(html).toContain("Down arrow");
    expect(html).toContain("Space");
  });

  it("uses role=dialog with aria-modal", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("never includes an em-dash in rendered copy (project rule)", () => {
    expect(html).not.toMatch(/[–—]/u);
  });
});
