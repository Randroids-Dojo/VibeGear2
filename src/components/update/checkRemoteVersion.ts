/**
 * Pure helper that asks the server which build it is running and
 * compares the answer to the `currentVersion` baked into the client
 * bundle at compile time.
 *
 * Splitting the network and comparison logic out of the React
 * component lets the Vitest suite cover every branch without a real
 * DOM. The component only owns the timer plumbing.
 *
 * Result kinds:
 *   - `"stale"` ........ remote SHA differs from the local one. The
 *                        banner must show.
 *   - `"fresh"` ........ remote SHA matches. No action.
 *   - `"error"` ........ network failure or non-2xx response. Must be
 *                        swallowed silently per the slice spec
 *                        (showing a transient backend error to the
 *                        player would defeat the purpose).
 *
 * The fetch impl is injected so tests can stub it without touching
 * `globalThis.fetch`.
 */

export type RemoteVersionResult = "stale" | "fresh" | "error";

export interface CheckRemoteVersionOptions {
  /**
   * The version string baked into the client bundle (typically
   * `BUILD_ID`). Compared verbatim against the server response.
   */
  currentVersion: string;
  /**
   * Optional fetch override. Defaults to the global `fetch`.
   */
  fetchImpl?: typeof fetch;
  /**
   * Endpoint to poll. Defaults to the canonical `/api/version`.
   */
  endpoint?: string;
}

const DEFAULT_ENDPOINT = "/api/version";

export async function checkRemoteVersion(
  options: CheckRemoteVersionOptions,
): Promise<RemoteVersionResult> {
  const {
    currentVersion,
    fetchImpl = globalThis.fetch,
    endpoint = DEFAULT_ENDPOINT,
  } = options;
  try {
    const res = await fetchImpl(endpoint, { cache: "no-store" });
    if (!res.ok) return "error";
    const body = (await res.json()) as { version?: unknown };
    if (typeof body.version !== "string") return "error";
    return body.version === currentVersion ? "fresh" : "stale";
  } catch {
    return "error";
  }
}
