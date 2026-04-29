import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { compileTrack } from "@/road/trackCompiler";
import { DEFAULT_TRACK } from "@/components/track-editor/defaultTrack";
import { RoadCanvas } from "../RoadCanvas";

describe("RoadCanvas SSR shell", () => {
  it("renders a stable canvas sized from the viewport", () => {
    const compiled = compileTrack(DEFAULT_TRACK);
    const html = renderToStaticMarkup(createElement(RoadCanvas, { compiled }));
    expect(html).toContain('data-testid="road-canvas"');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="480"');
  });
});
