"use client";

/**
 * Race route shell.
 *
 * Mounts the asset preload gate before the canvas. Until every critical
 * entry in the per-track manifest resolves, the player sees the loading
 * screen instead of a half-painted road. Source of truth for the gating
 * step: `docs/gdd/21-technical-design-for-web-implementation.md` (Renderer
 * + Audio preload).
 *
 * This slice ships a placeholder race body (a static "Race ready" card
 * with the decoded asset count) so the gate can be exercised end to end
 * without depending on the full §10 / §15 / §20 stack. Future slices will
 * replace the body with the real `<RaceCanvas>` while leaving the gate in
 * place.
 *
 * The gate runs against the `track.example.json` manifest by default since
 * the canonical track set has not landed yet. Once `src/data/tracks/`
 * ships, the route will read its track id from the URL and resolve via the
 * tracks registry.
 */

import { useMemo, type ReactElement } from "react";

import { createBrowserFetcher, type DecodedAsset } from "@/asset/preload";
import { manifestForTrack } from "@/asset/manifest";
import { LoadingGate } from "@/components/loading/LoadingGate";
import trackExample from "@/data/examples/track.example.json" with { type: "json" };
import type { Track } from "@/data/schemas";

const TRACK = trackExample as Track;

export default function RacePage(): ReactElement {
  const manifest = useMemo(
    () =>
      manifestForTrack({
        track: TRACK,
        weather: "clear",
        playerCarId: "sparrow-gt",
      }),
    [],
  );
  const fetcher = useMemo(() => createBrowserFetcher(), []);

  return (
    <LoadingGate manifest={manifest} fetcher={fetcher}>
      {(assets) => <RaceReady assets={assets} trackName={TRACK.name} />}
    </LoadingGate>
  );
}

interface RaceReadyProps {
  assets: ReadonlyMap<string, DecodedAsset>;
  trackName: string;
}

function RaceReady({ assets, trackName }: RaceReadyProps): ReactElement {
  return (
    <main
      data-testid="race-ready"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        background: "var(--bg, #111)",
        color: "var(--fg, #ddd)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Race ready</h1>
      <p style={{ margin: 0, color: "var(--muted, #aaa)" }}>{trackName}</p>
      <p data-testid="race-asset-count" style={{ margin: 0, color: "var(--muted, #aaa)" }}>
        {assets.size} asset{assets.size === 1 ? "" : "s"} loaded
      </p>
    </main>
  );
}
