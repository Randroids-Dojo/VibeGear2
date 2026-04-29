"use client";

import { useEffect, useState } from "react";

import { loadModContent } from "@/mods";

type SmokeState =
  | { status: "loading" }
  | { status: "ready"; modId: string; trackId: string; trackCount: number }
  | { status: "error"; message: string };

export function ModLoaderSmoke(): JSX.Element {
  const [state, setState] = useState<SmokeState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadModContent({ modId: "starter-sample" })
      .then((content) => {
        if (cancelled) return;
        setState({
          status: "ready",
          modId: content.manifest.id,
          trackId: content.tracks[0]?.id ?? "none",
          trackCount: content.tracks.length,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main data-testid="mod-loader-page">
      <h1>Mod Loader Smoke</h1>
      <p data-testid="mod-loader-status">{state.status}</p>
      {state.status === "ready" ? (
        <dl>
          <dt>Mod</dt>
          <dd data-testid="mod-id">{state.modId}</dd>
          <dt>Tracks</dt>
          <dd data-testid="mod-track-count">{state.trackCount}</dd>
          <dt>First track</dt>
          <dd data-testid="mod-track-id">{state.trackId}</dd>
        </dl>
      ) : null}
      {state.status === "error" ? (
        <pre data-testid="mod-loader-error">{state.message}</pre>
      ) : null}
    </main>
  );
}
