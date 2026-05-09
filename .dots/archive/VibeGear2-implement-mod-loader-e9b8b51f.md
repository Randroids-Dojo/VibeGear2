---
title: "implement: mod loader + manifest schema per §26"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:25:44.959321-05:00\\\"\""
closed-at: "2026-04-29T15:46:23.582829-05:00"
close-reason: "Merged PR #98 and PR #99, CI green, review comments addressed, production smoke passed at 5799ad0."
blocks:
  - VibeGear2-implement-licence-files-a7c7b931
  - VibeGear2-implement-11995c69
---

## Description

Add the `ModManifest` Zod schema, the `loadMods()` runtime that walks `public/mods/` and registers manifest-described content into a unified `DataRegistry`, the build-time `public/mods/index.json` generator, and the safe-mode flag.

Phase 5 stretch task per `docs/IMPLEMENTATION_PLAN.md`. The full design is in the binding "Findings" section of `.dots/archive/VibeGear2-research-track-editor-0c0353df.md`.

The loader is gated by `process.env.NEXT_PUBLIC_VG_FEATURE_MODS === "1"`. With the flag off, the loader registers core content only and never fetches `/mods/index.json`.

## Context

§26 ("Open source project guidance") requires:

1. Data mods only in v1.0 (no executable plugins).
2. All mod manifests require `author`, `license`, and `originality statement`.
3. Public mod browser must reject trademark-risk content (out of scope here; deferred to a post-v1.0 dot).

§22 ("Data schemas") defines the `Track`, `Car`, `Upgrade`, and `AIDriver` shapes that mods bundle. §21 ("Technical design") describes the mod layer. The licensing matrix from §26 (CC-BY-SA-4.0 for community track / data, CC-BY-4.0 for art / audio, MIT or Apache-2.0 for code) feeds the SPDX validation in safe mode.

This slice consumes the Q-002 licence resolution (which lands in `implement-licence-files-a7c7b931`), so its `after:` dependency is pinned.

## Affected Files

- `src/data/schemas.ts` (existing): add `ModManifestSchema` and `AttributionEntrySchema` per the spec in the research findings.
- `src/data/mods.ts` (new): `loadMods(opts): Promise<DataRegistry>` runtime; per-mod validation pipeline; namespacing checks; safe-mode filter.
- `src/data/registry.ts` (new): `DataRegistry` type and `createRegistry()` factory; merges core content + mod content under namespaced ids.
- `src/data/__tests__/mods.test.ts` (new): unit tests with mocked `fetch` covering each rejection branch listed in the research "testing" subsection.
- `scripts/build-mods-index.ts` (new): build-time script invoked from `package.json` `prebuild` that scans `public/mods/*/mod.json`, validates each, and writes `public/mods/index.json` (`{ ids: string[], builtAt: string }`).
- `package.json` (existing): add `prebuild` and `predev` invocations of the index generator behind the feature flag.
- `public/mods/.gitkeep` (new): keep the directory in git even when empty.
- `e2e/mods.spec.ts` (new): Playwright test that places a fixture mod into `public/mods/` before running, then asserts a track from the mod is selectable.
- `docs/MODDING.md` (separate dot `implement-modding-md-efbf1c83`): document the manifest format and SPDX matrix; this dot does not write that file but the manifest schema lands here so MODDING.md can reference it.

## Edge Cases

- A mod whose `manifest.id` does not match its directory name: loader logs a structured error and skips the entire mod.
- A mod with empty `originalityStatement`: loader skips.
- A mod with `originalityStatement.length < 80` while safe mode is on: loader skips.
- A mod with `license: "CUSTOM"` while safe mode is on: loader skips.
- Two mods registering tracks with the same namespaced id: both registrations rejected; both errors logged.
- A track inside a mod whose `track.id` does not start with `mod.id + "/"`: track skipped (other tracks in the mod still register).
- A `contents.tracks` path containing `..`: rejected as path traversal.
- `mod.json` returns a 404: loader logs and continues with remaining mods.
- `mod.json` parses but `safeParse` fails (bad schema): loader logs the Zod error path and skips the mod.
- `compileTrack` throws on a track inside a mod: that track is skipped; loader continues with the rest of the mod.
- Mod is disabled in `localStorage` `vg2.mods.enabled[id] === false`: loader does not fetch the manifest at all (faster boot, less network).

## Verify

- [ ] Vitest unit tests cover all rejection branches above.
- [ ] `loadMods()` returns a `DataRegistry` with deterministic `Map` insertion order (lexicographic by mod id, then by entity id within a mod) on repeat invocations.
- [ ] With `NEXT_PUBLIC_VG_FEATURE_MODS` unset, no fetch is issued for `/mods/index.json` and the loader returns a registry containing only core content.
- [ ] `scripts/build-mods-index.ts` produces a valid `public/mods/index.json` against a fixture mod tree under `public/mods/test-good/` and ignores a malformed `public/mods/test-bad/` entry.
- [ ] Playwright e2e installs a fixture mod under `public/mods/test-mod/`, runs the build, then verifies a track from `test-mod` appears in the track-select UI.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all green.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `.dots/archive/VibeGear2-research-track-editor-0c0353df.md` (binding spec, Findings).
- `docs/gdd/26-open-source-project-guidance.md`, `docs/gdd/22-data-schemas.md`, `docs/gdd/21-technical-design-for-web-implementation.md`.
- `src/data/schemas.ts` (existing Zod surface).
