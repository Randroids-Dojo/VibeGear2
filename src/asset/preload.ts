/**
 * Asset preloader.
 *
 * Source of truth: `docs/gdd/21-technical-design-for-web-implementation.md`
 * (Renderer + Audio layers). Phase 6 hardening's "no console errors during a
 * 30 s drive" gate is hard to meet without a deterministic preload step that
 * resolves every required atlas, sound buffer, and JSON before the race
 * mounts. This module is that gate.
 *
 * Contract:
 * - `preloadAll(manifest, options)` resolves to `{ assets, failures }`.
 *   `assets` is keyed by `AssetEntry.id`; `failures` lists every entry that
 *   threw, with the original error preserved so callers can decide whether
 *   the failure is fatal (critical asset) or surface-able (non-critical).
 * - The fetcher is injected so tests can drive every branch without touching
 *   the DOM. The default fetcher (`browserFetcher`) wraps `fetch`, `Image`,
 *   and `AudioContext.decodeAudioData` for the runtime path.
 * - Progress is reported through an optional `onProgress` callback after each
 *   entry settles (success or failure). Callers feed this into the loading
 *   screen store so the UI never reads its own progress from the loader.
 * - An optional `AbortSignal` cancels pending entries. Already-settled entries
 *   are not retroactively cancelled. After abort, in-flight rejections are
 *   swallowed so the console stays clean.
 *
 * Determinism:
 * - The output `assets` map and `failures` list iterate in input-manifest
 *   order regardless of which entry resolved first. This is necessary so
 *   golden-master snapshots and Playwright assertions remain stable when the
 *   loader runs against a real network.
 */

export type AssetKind = "image" | "audio" | "json";

export interface AssetEntry {
  /** Unique identifier within the manifest. Lowercase slug recommended. */
  id: string;
  /** What kind of asset to decode this as. */
  kind: AssetKind;
  /** Source URL, path, or arbitrary string the fetcher knows how to resolve. */
  src: string;
  /**
   * Whether the race can start without this asset. Critical assets block the
   * gate; non-critical ones are surfaced as warnings but do not stop the
   * race from mounting.
   */
  critical: boolean;
}

export interface AssetManifest {
  /** Stable identifier for the manifest (e.g. "track:velvet-coast/harbor-run"). */
  id: string;
  entries: readonly AssetEntry[];
}

export type DecodedAsset =
  | { kind: "image"; data: ImageBitmap | HTMLImageElement }
  | { kind: "audio"; data: AudioBuffer }
  | { kind: "json"; data: unknown };

export interface AssetFailure {
  id: string;
  kind: AssetKind;
  critical: boolean;
  error: unknown;
}

export interface PreloadResult {
  assets: ReadonlyMap<string, DecodedAsset>;
  failures: readonly AssetFailure[];
}

export interface AssetFetcher {
  /**
   * Decode a single manifest entry. Implementations must resolve to a
   * `DecodedAsset` whose `kind` matches `entry.kind`, or reject. They should
   * honour the abort signal where the underlying transport supports it.
   */
  fetch(entry: AssetEntry, signal?: AbortSignal): Promise<DecodedAsset>;
}

export interface PreloadOptions {
  fetcher: AssetFetcher;
  signal?: AbortSignal;
  /** Called after each entry settles (success or failure). */
  onProgress?: (event: PreloadProgressEvent) => void;
}

export interface PreloadProgressEvent {
  manifestId: string;
  total: number;
  completed: number;
  failed: number;
  /** The entry that just settled. */
  entry: AssetEntry;
  outcome: "success" | "failure";
}

/**
 * Sentinel error raised by callers and fetchers when the preload is
 * cancelled. Anything thrown after `signal.abort()` is treated as cancelled
 * and never appears in the `failures` list.
 */
export class PreloadAbortedError extends Error {
  override readonly name = "PreloadAbortedError";
  constructor(message = "asset preload aborted") {
    super(message);
  }
}

/**
 * Run an entire manifest in parallel. Always resolves (never rejects) so the
 * caller can render a partial-success UI. When the signal aborts, the
 * returned promise resolves with the assets that already settled and an
 * empty failures list for the cancelled entries.
 */
export async function preloadAll(
  manifest: AssetManifest,
  options: PreloadOptions,
): Promise<PreloadResult> {
  if (manifest.entries.length === 0) {
    return { assets: new Map(), failures: [] };
  }

  const { fetcher, signal, onProgress } = options;
  const indexedEntries = manifest.entries.map((entry, index) => ({ entry, index }));

  let completed = 0;
  let failed = 0;

  type Settled =
    | { index: number; outcome: "success"; asset: DecodedAsset }
    | { index: number; outcome: "failure"; failure: AssetFailure }
    | { index: number; outcome: "aborted" };

  const settled = await Promise.all(
    indexedEntries.map(async ({ entry, index }): Promise<Settled> => {
      if (signal?.aborted) {
        return { index, outcome: "aborted" };
      }
      try {
        const asset = await fetcher.fetch(entry, signal);
        if (signal?.aborted) {
          return { index, outcome: "aborted" };
        }
        if (asset.kind !== entry.kind) {
          throw new Error(
            `fetcher returned ${asset.kind} for entry ${entry.id} declared as ${entry.kind}`,
          );
        }
        completed += 1;
        onProgress?.({
          manifestId: manifest.id,
          total: manifest.entries.length,
          completed,
          failed,
          entry,
          outcome: "success",
        });
        return { index, outcome: "success", asset };
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) {
          return { index, outcome: "aborted" };
        }
        failed += 1;
        const failure: AssetFailure = {
          id: entry.id,
          kind: entry.kind,
          critical: entry.critical,
          error,
        };
        onProgress?.({
          manifestId: manifest.id,
          total: manifest.entries.length,
          completed,
          failed,
          entry,
          outcome: "failure",
        });
        return { index, outcome: "failure", failure };
      }
    }),
  );

  // Reassemble in manifest order so iteration order is stable.
  settled.sort((a, b) => a.index - b.index);

  const assets = new Map<string, DecodedAsset>();
  const failures: AssetFailure[] = [];
  for (const result of settled) {
    if (result.outcome === "success") {
      const id = manifest.entries[result.index]?.id;
      if (id !== undefined) {
        assets.set(id, result.asset);
      }
    } else if (result.outcome === "failure") {
      failures.push(result.failure);
    }
    // "aborted" entries are intentionally dropped.
  }

  return { assets, failures };
}

/**
 * True when at least one manifest entry that failed was marked `critical`.
 * The race route uses this to decide whether to surface a typed error vs
 * mount the canvas with placeholders.
 */
export function hasCriticalFailure(result: PreloadResult): boolean {
  return result.failures.some((f) => f.critical);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof PreloadAbortedError) return true;
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
  }
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return false;
}

/**
 * Default browser fetcher. Wraps `fetch`, the `Image` element, and an
 * injected `AudioContext.decodeAudioData`. Kept here so non-browser tests
 * can swap in a deterministic implementation without dragging the DOM into
 * the test environment.
 */
export interface BrowserFetcherDeps {
  fetch?: typeof globalThis.fetch;
  audioContext?: { decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> };
  /** Image constructor; defaults to `globalThis.Image`. */
  ImageCtor?: { new (): HTMLImageElement };
}

export function createBrowserFetcher(deps: BrowserFetcherDeps = {}): AssetFetcher {
  return {
    async fetch(entry, signal): Promise<DecodedAsset> {
      switch (entry.kind) {
        case "json": {
          const fetchFn = deps.fetch ?? globalThis.fetch;
          if (!fetchFn) {
            throw new Error("no fetch implementation available for json asset");
          }
          const response = await fetchFn(entry.src, signal ? { signal } : undefined);
          if (!response.ok) {
            throw new Error(`json fetch failed: ${response.status} ${response.statusText}`);
          }
          const data = (await response.json()) as unknown;
          return { kind: "json", data };
        }
        case "audio": {
          const fetchFn = deps.fetch ?? globalThis.fetch;
          if (!fetchFn) {
            throw new Error("no fetch implementation available for audio asset");
          }
          const ctx = deps.audioContext;
          if (!ctx) {
            throw new Error("no AudioContext available for audio asset");
          }
          const response = await fetchFn(entry.src, signal ? { signal } : undefined);
          if (!response.ok) {
            throw new Error(`audio fetch failed: ${response.status} ${response.statusText}`);
          }
          const buffer = await response.arrayBuffer();
          const decoded = await ctx.decodeAudioData(buffer);
          return { kind: "audio", data: decoded };
        }
        case "image": {
          const ImageCtor =
            deps.ImageCtor ?? (globalThis as { Image?: { new (): HTMLImageElement } }).Image;
          if (!ImageCtor) {
            throw new Error("no Image constructor available for image asset");
          }
          return await new Promise<DecodedAsset>((resolve, reject) => {
            const img = new ImageCtor();
            const cleanup = (): void => {
              img.onload = null;
              img.onerror = null;
              if (signal && abortHandler) {
                signal.removeEventListener("abort", abortHandler);
              }
            };
            const abortHandler = signal
              ? (): void => {
                  cleanup();
                  reject(new PreloadAbortedError());
                }
              : null;
            if (signal && abortHandler) {
              signal.addEventListener("abort", abortHandler, { once: true });
            }
            img.onload = (): void => {
              cleanup();
              resolve({ kind: "image", data: img });
            };
            img.onerror = (event): void => {
              cleanup();
              reject(event instanceof Error ? event : new Error(`image load failed: ${entry.src}`));
            };
            img.src = entry.src;
          });
        }
      }
    },
  };
}
