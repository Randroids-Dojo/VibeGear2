import { describe, expect, it } from "vitest";

import {
  BUILD_ID,
  BUILD_VERSION,
  formatBuildBadge,
  isDevBuild,
} from "../buildInfo";

/**
 * Build identity smoke. The compiled values come from
 * `next.config.mjs` env injection, which Vitest does not run. Under
 * the test runner the module-eval path falls back to the dev
 * sentinels ("dev" / "0.0.0-dev"). We assert the contract those
 * sentinels promise rather than pinning the exact strings, so the
 * suite stays green on any future env-injection change.
 */
describe("buildInfo", () => {
  it("BUILD_ID is a non-empty string with no leading or trailing whitespace", () => {
    expect(typeof BUILD_ID).toBe("string");
    expect(BUILD_ID.length).toBeGreaterThan(0);
    expect(BUILD_ID).toBe(BUILD_ID.trim());
  });

  it("BUILD_VERSION is a non-empty string with no leading or trailing whitespace", () => {
    expect(typeof BUILD_VERSION).toBe("string");
    expect(BUILD_VERSION.length).toBeGreaterThan(0);
    expect(BUILD_VERSION).toBe(BUILD_VERSION.trim());
  });

  it("isDevBuild reflects whether BUILD_ID is the dev sentinel", () => {
    expect(typeof isDevBuild).toBe("boolean");
    expect(isDevBuild).toBe(BUILD_ID === "dev");
  });

  it("falls back to 'dev' when next.config.mjs has not injected the env vars (vitest path)", () => {
    // Vitest never runs generateBuildId, so the dev fallback is the
    // expected runtime value here. This test pins the contract so a
    // future refactor that drops the fallback is caught.
    expect(BUILD_ID).toBe("dev");
    expect(BUILD_VERSION).toBe("0.0.0-dev");
    expect(isDevBuild).toBe(true);
  });

  it("formatBuildBadge composes 'v<version> (<id>)' for arbitrary inputs", () => {
    expect(formatBuildBadge("1.2.3", "abc1234")).toBe("v1.2.3 (abc1234)");
    expect(formatBuildBadge("0.1.0", "deadbee")).toBe("v0.1.0 (deadbee)");
  });

  it("formatBuildBadge defaults to the live BUILD_VERSION and BUILD_ID", () => {
    expect(formatBuildBadge()).toBe(`v${BUILD_VERSION} (${BUILD_ID})`);
  });
});
