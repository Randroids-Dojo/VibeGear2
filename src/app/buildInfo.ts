/**
 * Build identity exposed to runtime code.
 *
 * `next.config.mjs` resolves the git short SHA and the `package.json`
 * version at build time and bakes them into the client bundle as
 * `process.env.NEXT_PUBLIC_BUILD_ID` and
 * `process.env.NEXT_PUBLIC_BUILD_VERSION`. This module re-exports the
 * baked values as typed string constants so call sites do not have to
 * reach into `process.env` (which is `string | undefined` in the
 * Next.js types) on every read.
 *
 * Per GDD section 21 ("Asset pipeline") this is the asset-pipeline
 * checksum version. Three downstream consumers depend on it:
 *
 *   1. The opt-in client error reporter
 *      (`VibeGear2-implement-opt-in-b65cbbb8`) attaches `BUILD_ID` to
 *      every captured error so a dev can map the stack trace back to
 *      the exact source revision.
 *   2. The tagged-release smoke test
 *      (`VibeGear2-implement-tagged-release-b3d30084`) reads the
 *      deployed page's `BUILD_VERSION` to confirm the deployed build
 *      matches the tag commit.
 *   3. Manual cross-browser passes
 *      (`VibeGear2-implement-cross-browser-7cf643ce`) log the
 *      `BUILD_ID` they exercised so reproducer reports pin a precise
 *      commit.
 *
 * Local `next dev` runs do NOT execute `generateBuildId`, so the env
 * vars resolve to `undefined` at module-eval time. The fallback values
 * ("dev" / "0.0.0-dev") keep the constants typed as `string` and let
 * UI code render the badge without a guard. `isDevBuild` is the
 * canonical "should we hide build-only chrome" check.
 */

export const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

export const BUILD_VERSION: string =
  process.env.NEXT_PUBLIC_BUILD_VERSION ?? "0.0.0-dev";

export const isDevBuild: boolean = BUILD_ID === "dev";

/**
 * Format the build identifiers for human display. The title-screen
 * footer renders this string. Kept as a pure helper so other surfaces
 * (settings page, error toasts) can reuse the same canonical format.
 */
export function formatBuildBadge(
  version: string = BUILD_VERSION,
  id: string = BUILD_ID,
): string {
  return `v${version} (${id})`;
}
