---
title: "implement: track editor (dev page) per §26"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:25:43.953228-05:00\\\"\""
closed-at: "2026-04-29T14:43:06.458746-05:00"
close-reason: "Merged PR #96, CI green, production smoke passed, dev editor production gate returns 404."
blocks:
  - VibeGear2-implement-11995c69
---

## Description

Build a dev-only Next.js page at `/dev/track-editor` that lets a human author a `Track` JSON by editing fields in a tabular UI, previews the compiled track in real time using the existing `<RoadCanvas />` and `compileTrack()` modules, and supports JSON import / export round-tripping.

Phase 5 stretch task per `docs/IMPLEMENTATION_PLAN.md`. The full UX spec is in the binding "Findings" section of `.dots/archive/VibeGear2-research-track-editor-0c0353df.md`.

The editor is gated behind `process.env.NODE_ENV !== "production"` AND `process.env.NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR === "1"`. It does not ship in deployed bundles for v0.1; the production-shipped editor mount is a later slice.

## Context

§26 ("Open source project guidance") describes a track editor for community modders. §9 ("Track design") sets the authoring conventions the editor surfaces. §22 ("Data schemas") defines the canonical `Track` JSON the editor produces. The pseudo-3D research and track-authoring research are the binding contract for the underlying renderer and compiler.

This slice is dev-only authoring infrastructure: it does not change runtime gameplay. It exists so core authors (and later modders) can hand-author tracks without writing JSON in a text editor.

## Affected Files

- `src/app/dev/track-editor/page.tsx` (new): top-level page, gated by env flag, renders `<TrackEditor />`.
- `src/app/dev/track-editor/layout.tsx` (new): minimal layout (no global chrome) so the editor uses full viewport.
- `src/components/track-editor/TrackEditor.tsx` (new): two-pane container, owns the `Track`-shaped React state.
- `src/components/track-editor/SegmentTable.tsx` (new): keyboard-editable table for `track.segments`.
- `src/components/track-editor/CheckpointPanel.tsx` (new): collapsible panel for `track.checkpoints`; auto-injects start checkpoint.
- `src/components/track-editor/MetaHeader.tsx` (new): inputs for `id, name, tourId, laps, lengthMeters, weatherOptions, difficulty, laneCount, author, version`.
- `src/components/track-editor/PreviewPane.tsx` (new): re-mounts `<RoadCanvas />` against the live compiled track; auto-scroll camera toggle.
- `src/components/track-editor/WarningsPanel.tsx` (new): renders `compileTrack` warnings with click-to-jump action.
- `src/components/track-editor/io.ts` (new): `exportTrack(track): Blob` and `importTrack(file): Promise<Track>` helpers, both running through `TrackSchema.safeParse`.
- `src/components/track-editor/__tests__/TrackEditor.test.tsx` (new): RTL tests per the spec list below.
- `e2e/track-editor.spec.ts` (new): Playwright end-to-end test exercising the keyboard authoring path and the export round-trip.
- `.env.development.example` (existing or new): document `NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR=1` for opting in.

## Edge Cases

- Pasting JSON via the import button that fails `TrackSchema.safeParse` must NOT mutate state; an error banner appears and the prior valid track stays loaded.
- Deleting the start checkpoint must be impossible (button disabled, keyboard shortcut ignored).
- Editing `len` to 0 or a non-numeric value must show a field-level error and not crash the preview.
- `compileTrack` throwing must render the error in a banner without blanking the segment list.
- Importing a track whose `segments` count differs from the current state must rebuild the segment table without retaining stale row state.
- Reordering rows via up/down buttons must keep checkpoints' `segmentIndex` valid; the editor either remaps or shows a warning when an index would become invalid.

## Verify

- [ ] `npm run dev` then visit `/dev/track-editor` with `NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR=1` in env. The page renders the segment table, header, and preview pane.
- [ ] With the flag unset, the page returns a 404 or a "feature disabled" banner.
- [ ] In production builds (`npm run build && npm run start`) the route is not reachable.
- [ ] Vitest test suite covers: render with known good track; edit `len` and observe re-compile; reject invalid import without mutating state; round-trip export then re-import yields deep-equal.
- [ ] `npm run test:e2e` Playwright test passes the keyboard authoring + export flow.
- [ ] No console errors during normal authoring.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `.dots/archive/VibeGear2-research-track-editor-0c0353df.md` (binding spec, Findings).
- `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md` (compiler contract).
- `docs/gdd/26-open-source-project-guidance.md`, `docs/gdd/09-track-design.md`, `docs/gdd/22-data-schemas.md`.

## Spec stress-test (iteration 18, researcher pass)

Inspecting the repo before implementation reveals concrete corrections this dot must own that the Description / Affected Files do not yet surface:

1. **There is no `<RoadCanvas />` React component to reuse.** The renderer ships as a pure function `drawRoad(ctx, strips, viewport, options)` from `@/render/pseudoRoadCanvas`. Every existing dev page (`src/app/dev/road/page.tsx`, `src/app/dev/physics/page.tsx`, `src/app/dev/ai/page.tsx`) builds its own `<canvas>` ref, runs an rAF loop, calls `project()` then `drawRoad()`. The dot's "re-mounts `<RoadCanvas />`" line is wrong as written. Two viable fixes:
   - **Recommended:** introduce a thin `src/components/render/RoadCanvas.tsx` wrapper as part of this slice (props: `compiled: CompiledTrack`, `cameraZ`, `autoScroll`, `viewport`). Reuses `project()` + `drawRoad()` internally. Future race-route slices and the editor both consume it; eliminates the dev-page boilerplate. Add this file to the Affected Files list and add a one-line render test in `__tests__/RoadCanvas.test.tsx` that mounts the component, supplies a fixture compiled track, and asserts the canvas has been drawn (mock `getContext`, assert `fillRect` called).
   - Alternative: inline the canvas mount + rAF loop inside `PreviewPane.tsx`. Cheaper for this slice but duplicates the dev-page pattern; fails the "extract abstractions justified by >=3 callers" test from WORKING_AGREEMENT once the race route lands.

2. **Editor consumes `compileTrack(track: Track)`, not `compileSegments(authored)`.** The lower-level `compileSegments(authored: TrackSegment[])` returns a `CompiledSegmentBuffer` (not a `CompiledTrack`), used only by dev pages that fabricate test data without a full Track. The editor edits a real `Track`, so it imports `compileTrack`. The error class to catch is `TrackCompileError` (named export from `@/road/trackCompiler`); soft warnings live on `compiledTrack.warnings: readonly string[]`. The two-layer surface (hard errors via try/catch, lints via warnings array) lines up with the dot's "track-level" + "lint-level" validation panels.

3. **`MetaHeader` field list is missing `spawn.gridSlots`.** `TrackSchema` (src/data/schemas.ts:71-85) requires `spawn: { gridSlots: positiveInt }`. Without it, `safeParse` rejects the in-progress track and `compileTrack` never runs on any new draft. Add `gridSlots` (numeric input, default 8 to match the soft warning floor in `trackCompiler.ts`) to `MetaHeader.tsx`. Also confirm the listed fields `tourId, author, version, difficulty` are present (they are required by TrackSchema and are correctly listed in the dot) and that `version` is rendered as a positive integer input, not a free-text input.

4. **Default-state Track must validate against `TrackSchema` from first render.** The dot's "renders the segment table" verify line presumes the editor has a non-crashing initial track. Recommended seed: id `dev-untitled`, name `Untitled Track`, tourId `dev`, author `local`, version 1, laps 1, laneCount 2, lengthMeters equal to one `SEGMENT_LENGTH * 4` segment (so `compileTrack`'s `MIN_COMPILED_SEGMENTS = 4` floor passes), `weatherOptions: ["clear"]`, difficulty 1, segments containing four entries each with `len: SEGMENT_LENGTH, curve: 0, grade: 0, roadsideLeft: "default", roadsideRight: "default", hazards: []`, checkpoints `[{ segmentIndex: 0, label: "start" }]`, spawn `{ gridSlots: 8 }`. Document this seed in a constant `DEFAULT_TRACK` inside `TrackEditor.tsx` so unit tests can import it.

5. **Env flag gating: only `NEXT_PUBLIC_*` is exposed in the client bundle.** The dot already uses `NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR` correctly. The research dot mentioned `VG_FEATURE_TRACK_EDITOR=1`; ignore that name since the editor runs in the browser. The `.env.development.example` line should read `NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR=1`. The page guard pattern: `export const dynamic = "force-static"` plus a server-side `notFound()` when the flag is unset and `process.env.NODE_ENV === "production"` is also acceptable; pick whichever the implementer has already used elsewhere (currently no precedent exists).

6. **`e2e/track-editor.spec.ts` is blocked by the Playwright re-open dot.** The Playwright harness is currently re-opened (`VibeGear2-implement-add-playwright-64eb2a44`) because its prior close did not actually land the artefacts on the working trunk. Until it merges, the editor's e2e file should be filed as a followup (F-NNN: "Playwright e2e for /dev/track-editor authoring + export round-trip; deferred until F-002 lands the harness"). This mirrors the pause-overlay dot's F-016 and the touch-input dot's F-017 precedent. Do not skip the test silently; file the followup so it is recoverable.

7. **`compileTrack` is pure and re-runnable, but the editor must memoise.** The dot says "re-runs `compileTrack(track)` on every state change". A 100-segment track is fine to recompile per keystroke, but `useMemo([track])` with `track` as the dependency is the simplest way to avoid duplicate work in the same render cycle. For very large authored tracks the implementer can add a debounce (200 ms); leave that as a polish followup, not in this slice.

8. **`weatherOptions` and `roadsideLeft / roadsideRight` are `WeatherOption` enums and slug-shaped strings respectively.** The schema does not enforce roadside ids against any registry today (any non-empty string passes), so the editor renders a free-text input for those columns. `weatherOptions` is a multi-select bound to `WeatherOptionSchema.options`. Document this asymmetry in the SegmentTable's column headers so authors are not surprised when an arbitrary roadside id passes validation but later fails to render (the renderer does not look up sprite ids today; that lookup lands in the visual-polish slice).

9. **`TrackSchema.safeParse` MUST run on every edit, not just on import.** The dot says "TrackSchema.safeParse() on each edit -> error banner" in the data-flow diagram, but the Affected Files do not pin that to `TrackEditor.tsx` (or wherever ownership lives). Recommendation: a single `validateAndCompile(track) -> { ok: false, error } | { ok: true, compiled }` helper inside `io.ts` that runs `safeParse` then `compileTrack` and returns a tagged union. `TrackEditor.tsx` consumes that helper for both the live preview and the export path. This collapses the two parse points into one and lets the import-vs-edit branches share semantics.

10. **The dot's `blocks: VibeGear2-implement-11995c69` is satisfied.** The compiler dot closed with `close-reason: verified`; its artefacts (full `compileTrack` + golden tests) are present in `src/road/trackCompiler.ts` and `src/road/__tests__/`. The implementer can proceed without re-running the compiler audit.

### Pre-flight required before implementer starts

The implementer should reply to whoever picks up this dot with their pick on items 1 (RoadCanvas wrapper vs inline canvas) and 5 (which env-gating pattern). If left ambiguous, default to: build a thin `RoadCanvas` wrapper component as part of this slice (item 1), and use a client-side `if (!process.env.NEXT_PUBLIC_VG_FEATURE_TRACK_EDITOR) return notFoundFallback()` early-return in the page (item 5) since there is no precedent in the repo today.
