---
title: "implement: build version stamping + git SHA exposure + sourcemap generation per §21 release pipeline"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:09:16.851615-05:00\\\"\""
closed-at: "2026-04-26T08:38:27.378742-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-opt-in-b65cbbb8
  - VibeGear2-implement-tagged-release-b3d30084
  - VibeGear2-implement-cross-browser-7cf643ce
---

## Description

Stamp every build with the package version and the git short SHA. Surface
both at runtime via a single import (`src/app/buildInfo.ts`). Generate
production source maps and ensure they ship with the build artefact (Next.js
emits them by default for client bundles; this slice makes the behaviour
explicit and adds a CI artefact-upload step). Adds a hidden "build" line to
the title-screen HUD overlay so a manual smoke can confirm the deployed build
matches the expected commit.

## Context

GDD §21 "Asset pipeline" calls for "Build-time checksum versioning". Today,
`package.json` is at `0.0.0` and there is no exposure of the underlying git
SHA. Three downstream slices need this:

1. `implement-opt-in-b65cbbb8` (error reporting): every captured error must
   include the build SHA so the dev can map the stack trace to the exact
   commit. Without this slice, error reports are unattributed.
2. `implement-tagged-release-b3d30084`: the v0.1 release smoke test must
   confirm "the deployed build is the SHA of the tag commit"; without an
   exposed build version that smoke is a manual page-source inspection.
3. `implement-cross-browser-7cf643ce`: manual cross-browser passes log the
   build version they exercised; pinning is essential for reproducing
   reported bugs.

The slice is intentionally small and zero-runtime-cost: a Next.js
`generateBuildId` reads the SHA, `next.config.mjs` exposes it via
`env.NEXT_PUBLIC_BUILD_ID` and `env.NEXT_PUBLIC_BUILD_VERSION`, and a tiny
`buildInfo.ts` re-exports them as typed strings.

## Affected Files

- `next.config.mjs` (modify):
  - `generateBuildId: async () => execSync("git rev-parse --short HEAD").toString().trim()`
    falling back to `process.env.GIT_SHA ?? "dev"` when the git command
    fails (CI containers without `.git`, e.g. some Vercel build images, set
    `GIT_SHA` from the platform env).
  - `env: { NEXT_PUBLIC_BUILD_ID: <buildId>, NEXT_PUBLIC_BUILD_VERSION:
    <pkg.version> }` so the values are baked into the client bundle at
    build time and tree-shaken to constants.
  - Confirm `productionBrowserSourceMaps: true` (default in Next.js but make
    it explicit and test for it).
- `src/app/buildInfo.ts` (new): typed re-export
  `export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
   export const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "0.0.0-dev";
   export const isDevBuild = BUILD_ID === "dev";`
- `src/app/page.tsx` or whichever the title shell becomes (modify): bottom-
  right footer text `v${BUILD_VERSION} (${BUILD_ID})` styled small + dim;
  hidden behind `prefers-reduced-motion`-tier visibility (always rendered,
  but readable). Removed before final release? No: a footer build stamp is
  standard for shipped games. Document the placement decision in
  PROGRESS_LOG.
- `src/app/__tests__/buildInfo.test.ts` (new): asserts both constants are
  strings, asserts `isDevBuild` reflects the value, asserts no leading
  whitespace.
- `package.json` (modify): keep the existing `version` (do not bump here,
  that is the tagged-release slice's job). Document that
  `NEXT_PUBLIC_BUILD_VERSION` reads `package.json` at build time via the
  config.
- (CI artefact step) `docs/gdd/21-technical-design-for-web-implementation.md`
  (modify): one-paragraph "Build version stamping" subsection under "Asset
  pipeline" naming the env vars and the `git rev-parse --short HEAD`
  derivation. The CI workflow file (created in the F-003 deploy slice when
  Q-003 is answered) will upload the source maps as a build artefact;
  document the expectation here so the deploy slice picks it up.

## Edge Cases

- Build outside a git repo (e.g. `npm pack` of the source tree): `git
  rev-parse` fails; the fallback `process.env.GIT_SHA ?? "dev"` keeps the
  build green and the badge reads "dev".
- Detached HEAD or shallow clone (CI default): `git rev-parse --short HEAD`
  still works in shallow clones.
- The dev server (`next dev`) does not call `generateBuildId`; the env vars
  resolve to `dev` / `0.0.0-dev` at runtime which is the intended behaviour.
  Document this so a dev does not panic seeing "dev" locally.
- Source maps must NOT include the workspace path of the build agent. Next.js
  default already strips this; confirm with a smoke that opens the produced
  `.js.map` and greps for `/Users/` or `/home/`.
- Source maps double the deploy artefact size; do not ship them to public
  browsers in production by default. Vercel / Cloudflare Pages strip
  `.map` on request unless explicitly served. Document the pattern here so
  the F-003 deploy slice picks the right config (most agents will keep
  source maps as build-only artefacts uploaded to the error-reporting
  service in the opt-in dot).

## Verify

- [ ] `npm run build` succeeds; the produced `.next/static/chunks/*.js` files
      contain the literal build SHA and version (smoke: grep the build
      output for `BUILD_VERSION` and confirm a non-`undefined` value).
- [ ] `next start` serves a page whose source contains the build version.
- [ ] Unit test for `buildInfo.ts` confirms constant types and dev fallback.
- [ ] `productionBrowserSourceMaps: true` is set; a `.map` file is emitted
      next to each `.js` in `.next/static/chunks/`.
- [ ] `grep -E '/Users/|/home/' .next/static/chunks/*.js.map` returns nothing
      (no workspace paths leaked). If any emerge, document and file an F-NNN.
- [ ] No em-dashes or en-dashes in added files.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.
- [ ] GDD §21 has the new "Build version stamping" subsection.

## References

- `docs/gdd/21-technical-design-for-web-implementation.md` "Asset pipeline"
  ("Build-time checksum versioning").
- Next.js docs: `generateBuildId`, `productionBrowserSourceMaps`, `env`.
- `.dots/VibeGear2-implement-opt-in-b65cbbb8.md` (consumes BUILD_ID).
- `.dots/VibeGear2-implement-tagged-release-b3d30084.md` (consumes
  BUILD_VERSION).
- `.dots/VibeGear2-implement-cross-browser-7cf643ce.md` (manual smoke logs
  the BUILD_ID for repro).
