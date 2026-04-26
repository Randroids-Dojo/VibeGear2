"use client";

/**
 * Dev-only verification page for `<LoadingGate />` (closes part of F-018).
 *
 * Visit `/dev/loading` to drive the loading screen state machine end to
 * end with a synthetic asset manifest. Each entry is resolved by an
 * in-page fetcher that delays its `setTimeout` resolution by the value
 * of the `?delay=<ms>` query parameter (default 200 ms). The Playwright
 * spec (`e2e/loading-screen.spec.ts`) increases the delay so it can
 * observe the bar advancing through partial-success states before the
 * gate exits.
 *
 * The synthetic manifest is critical-only by default so the gate's
 * happy path is the one under test. Pass `?fail=1` to mark one entry
 * as a critical failure and surface the retry button.
 *
 * The route is excluded from the title-screen menu and the title-screen
 * smoke test.
 */

import { Suspense, useMemo, type ReactElement, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { LoadingGate } from "@/components/loading/LoadingGate";
import type {
  AssetEntry,
  AssetFetcher,
  AssetManifest,
  DecodedAsset,
} from "@/asset/preload";

const DEFAULT_DELAY_MS = 200;
const ENTRY_COUNT = 4;

export default function LoadingDevPage(): ReactElement {
  return (
    <Suspense fallback={<LoadingDevShell>Loading dev shell...</LoadingDevShell>}>
      <LoadingDev />
    </Suspense>
  );
}

function LoadingDev(): ReactElement {
  const search = useSearchParams();
  const rawDelay = search?.get("delay");
  const parsed = rawDelay !== null && rawDelay !== undefined ? Number.parseInt(rawDelay, 10) : NaN;
  const delayMs = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DELAY_MS;
  const failOne = search?.get("fail") === "1";

  const manifest = useMemo<AssetManifest>(
    () => buildManifest(failOne),
    [failOne],
  );
  const fetcher = useMemo<AssetFetcher>(() => buildFetcher(delayMs), [delayMs]);

  return (
    <LoadingGate manifest={manifest} fetcher={fetcher}>
      {(assets) => (
        <LoadingDevShell>
          <header data-testid="loading-dev-ready">
            Race ready. {assets.size} assets loaded.
          </header>
          <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {[...assets.keys()].map((id) => (
              <li key={id} data-testid={`loading-dev-asset-${id}`}>
                {id}
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, color: "var(--muted, #aaa)" }}>
            Append <code>?delay=300</code> to slow each asset, or
            <code> ?fail=1</code> to force a critical failure and exercise
            the retry button.
          </p>
        </LoadingDevShell>
      )}
    </LoadingGate>
  );
}

function buildManifest(failOne: boolean): AssetManifest {
  const entries: AssetEntry[] = [];
  for (let i = 0; i < ENTRY_COUNT; i += 1) {
    entries.push({
      id: `dev-asset-${i + 1}`,
      kind: "json",
      src: `inline://dev-${i + 1}`,
      critical: true,
      license: "CC0-1.0",
    });
  }
  if (failOne) {
    entries.push({
      id: "dev-asset-fail",
      kind: "json",
      src: "inline://dev-fail",
      critical: true,
      license: "CC0-1.0",
    });
  }
  return {
    id: failOne ? "dev:loading:with-failure" : "dev:loading",
    entries,
  };
}

function buildFetcher(delayMs: number): AssetFetcher {
  return {
    async fetch(entry, signal): Promise<DecodedAsset> {
      // Reject early if the caller already aborted; matches the
      // contract `LoadingGate` relies on for unmount cancellation.
      if (signal?.aborted) {
        throw new Error("aborted");
      }

      // Inject a `dev-asset-fail` entry so the retry path is reachable.
      // The id is stable so the spec can wait on it deterministically.
      const shouldFail = entry.id === "dev-asset-fail";

      return await new Promise<DecodedAsset>((resolve, reject) => {
        const timeout = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          if (shouldFail) {
            reject(new Error(`forced failure for ${entry.id}`));
            return;
          }
          resolve({ kind: "json", data: { id: entry.id } });
        }, delayMs);
        const onAbort = (): void => {
          clearTimeout(timeout);
          reject(new Error("aborted"));
        };
        signal?.addEventListener("abort", onAbort);
      });
    },
  };
}

interface LoadingDevShellProps {
  children: ReactNode;
}

function LoadingDevShell({ children }: LoadingDevShellProps): ReactElement {
  return (
    <main
      data-testid="loading-dev-page"
      style={{
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        color: "var(--fg, #ddd)",
        background: "var(--bg, #111)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {children}
    </main>
  );
}
