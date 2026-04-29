import { useMemo, useState } from "react";

import { RoadCanvas } from "@/components/render/RoadCanvas";
import type { CompiledTrack } from "@/road/types";

interface PreviewPaneProps {
  readonly compiled: CompiledTrack | null;
}

export function PreviewPane({ compiled }: PreviewPaneProps) {
  const [cameraZ, setCameraZ] = useState(0);
  const maxZ = compiled?.totalLengthMeters ?? 0;
  const clampedZ = useMemo(() => Math.min(Math.max(0, cameraZ), Math.max(0, maxZ - 1)), [cameraZ, maxZ]);

  return (
    <section aria-labelledby="track-editor-preview-title" data-testid="track-editor-preview">
      <h2 id="track-editor-preview-title">Preview</h2>
      {compiled ? (
        <>
          <RoadCanvas compiled={compiled} cameraZ={clampedZ} testId="track-editor-canvas" />
          <label style={{ display: "grid", gap: "0.35rem", marginTop: "0.75rem" }}>
            <span>Camera Z</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, maxZ - 1)}
              step={1}
              value={clampedZ}
              onChange={(event) => setCameraZ(Number(event.currentTarget.value))}
            />
          </label>
        </>
      ) : (
        <div data-testid="track-editor-preview-blocked" style={{ minHeight: "12rem", display: "grid", placeItems: "center", background: "#101827" }}>
          Fix validation errors to preview.
        </div>
      )}
    </section>
  );
}
