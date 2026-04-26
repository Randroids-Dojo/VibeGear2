"use client";

/**
 * Loading gate.
 *
 * Wraps a render-fn (`children`) in a preload step. Until every entry in
 * the manifest settles, the gate renders `<LoadingScreen>`. On success it
 * mounts the children with the decoded asset map. On critical failure it
 * keeps the loading screen up with a retry handler.
 *
 * Source of truth: `docs/gdd/21-technical-design-for-web-implementation.md`
 * (Renderer + Audio preload). The gate exists so per-renderer modules do
 * not each decode their own assets on first use; that pattern leaves the
 * first frame missing sprites, the audio silent, and Playwright tests racy.
 *
 * Cancellation: an `AbortController` is created per mount and aborted on
 * unmount or manifest-id change. In-flight fetches see the abort and the
 * preloader drops their failures from the result.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";

import {
  hasCriticalFailure,
  preloadAll,
  type AssetFetcher,
  type AssetManifest,
  type DecodedAsset,
  type PreloadResult,
} from "@/asset/preload";

import { LoadingScreen } from "./LoadingScreen";
import {
  applyProgress,
  startLoading,
  type LoadingSnapshot,
} from "./loadingState";

export interface LoadingGateProps {
  manifest: AssetManifest;
  fetcher: AssetFetcher;
  /** Disables the progress bar transition. Wired from save settings. */
  reducedMotion?: boolean;
  /** Render with the decoded asset map once preload settles successfully. */
  children: (assets: ReadonlyMap<string, DecodedAsset>) => ReactNode;
  /** Optional hook for tests / telemetry to observe each settled event. */
  onSnapshot?: (snapshot: LoadingSnapshot) => void;
}

interface GateState {
  snapshot: LoadingSnapshot;
  result: PreloadResult | null;
  /** Bumped to retry the preload after a critical failure. */
  attempt: number;
}

export function LoadingGate(props: LoadingGateProps): ReactElement {
  const { manifest, fetcher, reducedMotion = false, children, onSnapshot } = props;

  const [state, setState] = useState<GateState>(() => ({
    snapshot: startLoading(manifest.id, manifest.entries.length),
    result: null,
    attempt: 0,
  }));

  // Keep the latest snapshot callback in a ref so the effect does not
  // re-run when the parent passes an inline lambda.
  const onSnapshotRef = useRef<typeof onSnapshot>(onSnapshot);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  // Reset the snapshot whenever the manifest identity changes or a retry is
  // requested. The actual preload is kicked off in the run-effect below.
  useEffect(() => {
    setState((prev) => ({
      snapshot: startLoading(manifest.id, manifest.entries.length),
      result: null,
      attempt: prev.attempt,
    }));
  }, [manifest.id, manifest.entries.length]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void preloadAll(manifest, {
      fetcher,
      signal: controller.signal,
      onProgress: (event) => {
        if (cancelled) return;
        const entry = event.entry;
        setState((prev) => {
          const next = applyProgress(prev.snapshot, {
            manifestId: event.manifestId,
            total: event.total,
            completed: event.completed,
            failed: event.failed,
            outcome: event.outcome,
            entryId: entry.id,
            critical: entry.critical,
          });
          onSnapshotRef.current?.(next);
          return { ...prev, snapshot: next };
        });
      },
    }).then((result) => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, result }));
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [manifest, fetcher, state.attempt]);

  const handleRetry = useCallback(() => {
    setState((prev) => ({
      snapshot: startLoading(manifest.id, manifest.entries.length),
      result: null,
      attempt: prev.attempt + 1,
    }));
  }, [manifest.id, manifest.entries.length]);

  // Empty manifest: nothing to load, mount the children immediately with
  // an empty asset map. Skips the gate entirely per the dot's edge case.
  const empty = manifest.entries.length === 0;
  const emptyAssets = useMemo(() => new Map<string, DecodedAsset>(), []);
  if (empty) {
    return <>{children(emptyAssets)}</>;
  }

  const result = state.result;
  if (result && !hasCriticalFailure(result)) {
    return <>{children(result.assets)}</>;
  }

  return (
    <LoadingScreen
      snapshot={state.snapshot}
      reducedMotion={reducedMotion}
      onRetry={result && hasCriticalFailure(result) ? handleRetry : undefined}
    />
  );
}
