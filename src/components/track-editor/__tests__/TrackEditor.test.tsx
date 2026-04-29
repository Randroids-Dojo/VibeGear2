import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TrackEditor } from "../TrackEditor";

describe("TrackEditor SSR shell", () => {
  const html = renderToStaticMarkup(createElement(TrackEditor));

  it("renders the editor layout and authoring sections", () => {
    expect(html).toContain('data-testid="track-editor-page"');
    expect(html).toContain('data-testid="track-editor-meta"');
    expect(html).toContain('data-testid="track-editor-segments"');
    expect(html).toContain('data-testid="track-editor-checkpoints"');
    expect(html).toContain('data-testid="track-editor-preview"');
  });

  it("renders the default valid draft", () => {
    expect(html).toContain("Untitled Track");
    expect(html).toContain("Track compiles.");
  });

  it("does not render forbidden dash characters", () => {
    expect(html).not.toMatch(new RegExp("[\\u2013\\u2014]", "u"));
  });
});
