/**
 * Vitest suite for `checkRemoteVersion`.
 *
 * Covers every branch of the helper that decides whether a long-lived
 * client tab is still on the deployed build:
 *
 *   - returns "stale" when the server reports a different SHA
 *   - returns "fresh" when the server reports the same SHA
 *   - returns "error" on a non-2xx response (silent swallow contract)
 *   - returns "error" on a malformed body (no `version` string)
 *   - returns "error" when fetch itself rejects (network blip)
 *
 * The fetch implementation is injected so the suite never touches
 * `globalThis.fetch`. Each test composes a minimal `Response`-shaped
 * stub with only the fields the helper reads.
 */

import { describe, expect, it, vi } from "vitest";

import { checkRemoteVersion } from "../checkRemoteVersion";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

describe("checkRemoteVersion", () => {
  it("returns 'stale' when the remote version differs from the current one", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ version: "newsha1" }));
    const result = await checkRemoteVersion({
      currentVersion: "oldsha0",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBe("stale");
    expect(fetchImpl).toHaveBeenCalledWith("/api/version", {
      cache: "no-store",
    });
  });

  it("returns 'fresh' when the remote version matches the current one", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ version: "samesha" }));
    const result = await checkRemoteVersion({
      currentVersion: "samesha",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBe("fresh");
  });

  it("returns 'error' on a non-2xx response (silent swallow)", async () => {
    const fetchImpl = vi.fn(
      async () => jsonResponse({ version: "newsha1" }, false),
    );
    const result = await checkRemoteVersion({
      currentVersion: "oldsha0",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBe("error");
  });

  it("returns 'error' when the JSON body lacks a string `version`", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const result = await checkRemoteVersion({
      currentVersion: "oldsha0",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBe("error");
  });

  it("returns 'error' when fetch rejects (network failure)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await checkRemoteVersion({
      currentVersion: "oldsha0",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBe("error");
  });

  it("respects a custom endpoint when provided", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ version: "x" }));
    await checkRemoteVersion({
      currentVersion: "x",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      endpoint: "/custom/version",
    });
    expect(fetchImpl).toHaveBeenCalledWith("/custom/version", {
      cache: "no-store",
    });
  });
});
