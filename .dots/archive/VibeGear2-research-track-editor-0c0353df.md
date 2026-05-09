---
title: "research: track editor + mod loading design per §26"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"\\\\\\\"2026-04-26T00:57:49.895522-05:00\\\\\\\"\\\"\""
closed-at: "2026-04-26T01:27:30.549614-05:00"
close-reason: "Specified track editor UX (dev page, two-pane keyboard-driven, reuses compileTrack + RoadCanvas) and mod loader contract (public/mods/<id>/mod.json manifest with required author/license/originalityStatement, namespaced ids, SPDX safe mode, deterministic lexicographic load order). Created implement dots: track-editor-fdb02792 and mod-loader-e9b8b51f. Refined modding-md-efbf1c83 with full document outline + dependencies."
blocks:
  - VibeGear2-research-track-authoring-ebc66903
---

Specify the editor UX and mod manifest format. Output: implement: dots for editor + mod loader. Per docs/gdd/26-open-source-project-guidance.md.

## Findings

### Scope and phasing (binding)

§26 places modding in Phase 5 with two narrow constraints:

1. "Data mods only in official loader for v1.0." No executable plugins, no JS hooks, no DLL-equivalents. A mod is a directory of JSON + asset files with a manifest.
2. "All mod manifests require author, license, and originality statement." Loader must reject mods missing any of these.

The research therefore covers two pieces, both Phase 5:

- **Track editor**: an in-app authoring UI that emits the same `Track` JSON the compiler already consumes (per `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md`). It is a thin authoring tool over the existing data contract, not a parallel format.
- **Mod loader**: a runtime that walks `public/mods/<mod-id>/`, validates each mod's manifest, and registers its tracks (and later cars / upgrades / AI drivers) into the running game's data registries.

Both ship behind a feature flag (`VG_FEATURE_MODS=1`) until the v1.0 stretch slice is reached. The feature flag is environment-only (no UI surface) so the loader code paths are exercised in tests but invisible to v0.1 players.

Out of scope for this research:

- Cloud mod browser / "official-safe" remote curation (§26 mentions it; defer to a post-v1.0 dot).
- Mod sandboxing for executable code (§26 explicitly forbids; revisit only if v1.x relaxes the rule).
- Replay or ghost mod packs (cross-cutting; their own followup).

### Track editor: target user and UX

Two user types served by one tool:

1. **Core team author** drafting tracks for the MVP set. Wants speed: keyboard-driven, deterministic JSON output, diffable in git.
2. **Community modder** building a track for their mod pack. Wants forgiveness: immediate validation feedback, can't accidentally produce a non-loading file.

A single React app at `/dev/track-editor` (gated by `VG_FEATURE_TRACK_EDITOR=1` in dev, plus a hard `process.env.NODE_ENV !== "production"` guard so it never ships in deployed bundles for v0.1) covers both. Production-shipped mod browsing can re-mount the editor under `/mods/editor` once curation rules exist; that is a later slice.

Two-pane layout, no animations, no drag-drop in MVP:

```
+----------------------+-----------------------+
| Segment list (left)  | Live preview (right)  |
|                      |                       |
| 0  180 m   curve 0.0 | (3D pseudo-renderer   |
| 1  140 m   curve 0.35|  re-mounts on every   |
| 2   80 m   curve 0.0 |  edit; same camera as |
| ...                  |  in-game)             |
|                      |                       |
| [+ add segment]      |                       |
| [validate]           | warnings panel below  |
| [export JSON]        |                       |
+----------------------+-----------------------+
| Header: meta fields (id, name, tourId, laps, lengthMeters, weatherOptions)        |
| Footer: status (valid / warnings count / errors count)                            |
+-----------------------------------------------------------------------------------+
```

Segment list is a `<table>` with one row per authored segment, columns `len / curve / grade / roadsideLeft / roadsideRight / hazards`. Each cell is an inline editable input bound to React state. Hitting Enter advances to the next cell. Tabbing through the row mirrors keyboard authoring of the JSON file.

No drag-and-drop reordering in MVP: instead, each row has up/down buttons and a delete button. Reordering by drag is filed as a followup (see below). This keeps the editor purely keyboard-friendly and removes the entire HTML5 drag-and-drop bug surface from MVP.

Checkpoints get their own collapsible panel below the segment list. Each row is `{ segmentIndex, label }`. The editor enforces `label === "start"` exists at `segmentIndex: 0` by auto-inserting one when the user creates a new track and refusing to delete it.

Live preview re-runs `compileTrack(track)` on every state change. If `compileTrack` throws, the preview pane shows the error message; the rest of the UI stays usable. If it returns warnings, the warnings panel lists each as `[severity] message (segmentIndex)` with a click-to-jump action that scrolls the segment list to that row.

The "export JSON" button drops a `.json` file via `Blob` + `URL.createObjectURL`. The "import JSON" button accepts a single `.json` file via `<input type="file">`, runs `TrackSchema.safeParse`, and rejects with a visible message on failure. There is no server round trip and no localStorage persistence in MVP — the editor is stateless across reloads to keep "what you see is what's in the file" honest. A future slice can add an autosave-to-localStorage layer behind a toggle.

### Track editor: data flow

```
React state (Track-shaped)
     |
     +-- TrackSchema.safeParse() on each edit ---> error banner
     |
     +-- compileTrack() ---> CompiledTrack ---> <RoadCanvas /> preview
     |                  \--> warnings ---> warnings panel
     |
     +-- export -> Blob -> download
     +-- import -> File -> JSON.parse -> safeParse -> setState
```

The compiler already exists in `src/road/trackCompiler.ts` (per the track-authoring research). The editor imports it directly: no duplicate validation, no duplicate compilation.

The preview canvas re-uses `<RoadCanvas />` from the pseudo-3D slice. The editor wires it with a synthetic camera that stays at z=0 looking down the track and an "auto-scroll" toggle that animates the camera forward at 30 m/s so authors can preview the feel without physics. No AI cars, no HUD, no input.

### Track editor: validation surface

Three layers, in order:

1. **Field-level**: each input has `aria-invalid` set to true when its bound `safeParse` fails. Error message appears below the cell.
2. **Track-level**: `compileTrack` errors render in a red banner above the segment list. Examples: missing start checkpoint, total length below minimum.
3. **Lint-level**: warnings render in a yellow panel below the segment list. Clicking jumps to the offending row.

The editor does NOT enforce the §26 originality / non-trademark rules — those are content-policy checks, not schema checks. Originality is enforced only at mod-loader registration time and at PR review time (see CONTRIBUTING). Mixing them in the editor would punish authors mid-keystroke for typing a placeholder name.

### Track editor: testing

Vitest + React Testing Library:

- Renders editor with a known good `Track`, asserts every segment row appears.
- Edits a `len` cell, asserts state updates and `compileTrack` re-runs.
- Imports an invalid `Track` JSON file (broken `weatherOptions`), asserts the error banner appears and state stays on the previous valid track.
- Exports the current state, parses the exported blob with `TrackSchema`, asserts round-trip equality with the in-memory state.
- Adding a segment with `len: 5` (below `SEGMENT_LENGTH=6`) shows the "rounds up to 1 compiled segment" warning.

Playwright e2e:

- Visit `/dev/track-editor`, add three segments via keyboard only, set checkpoint at index 0 with label "start", click "export JSON", read the downloaded file, assert it validates against `TrackSchema`.

These are Phase 5 tests; they are not blocking earlier phases. The editor's existence is not on the critical path to v0.1.

### Mod manifest format (binding)

`public/mods/<mod-id>/mod.json` is the entry point. Schema:

```ts
ModManifest {
  id: slug;                          // mirrors directory name; used as namespace
  name: string;                      // human-readable
  version: string;                   // semver, e.g. "1.0.0"
  schemaVersion: 1;                  // bump on breaking format changes
  author: string;                    // required per §26
  license: string;                   // SPDX identifier or "CUSTOM"; required per §26
  originalityStatement: string;      // required per §26; non-empty
  description?: string;
  homepageUrl?: string;
  contents: {
    tracks?: string[];               // relative paths under the mod dir, e.g. ["tracks/loop.json"]
    cars?: string[];
    upgrades?: string[];
    aiDrivers?: string[];
    art?: string[];                  // relative asset paths; loader validates extensions only
    audio?: string[];
  };
  attribution?: AttributionEntry[];  // for any 3rd party content
}

AttributionEntry {
  what: string;                      // "background sky texture", "engine SFX"
  source: string;                    // URL or descriptive
  license: string;                   // SPDX or descriptive
  authors: string[];
}
```

Validation rules (Zod schema in `src/data/schemas.ts` alongside existing schemas):

- `id` matches the slug regex used elsewhere (lowercase + hyphen / underscore).
- `id` MUST equal the parent directory name. The loader synthesises this constraint at load time.
- `version` matches semver `^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$`.
- `schemaVersion === 1`. Loader rejects unknown versions with a descriptive error.
- `license` is either an SPDX identifier (`MIT`, `Apache-2.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`) or the literal string `CUSTOM` (in which case the loader requires a sibling `LICENSE` file in the mod directory).
- `originalityStatement` is non-empty and at least 30 characters. The loader does not parse the text; the length floor is a friction nudge, not a guarantee.
- All paths in `contents.*` are relative, must not contain `..`, and resolve to files inside the mod directory. The loader rejects any escape attempt.
- `attribution[].license` follows the same SPDX-or-CUSTOM rule as the top-level license.

Required-fields enforcement is fail-fast: any missing required field on an enabled mod logs a structured error and skips the entire mod (no partial registration).

### Mod loader: discovery and load order

- Source directory: `public/mods/`. The `public/` prefix is mandatory because Next.js serves these as static files and they must be fetchable from the browser at runtime.
- Discovery at runtime in the browser: a build-time script writes `public/mods/index.json` listing all mod ids found at build time. The loader fetches `/mods/index.json`, then for each id fetches `/mods/<id>/mod.json`. This avoids needing filesystem access at runtime (which Next.js does not provide for client code).
- Load order: deterministic by `id` lexicographic. Mods cannot specify load order against each other in v1.0; if a future mod needs ordering it can prefix its id with a numeric (`zz_`, `01_`).
- Conflict resolution: a mod can register a track with id `mymod/loop`. Two mods registering the same track id is a hard error logged at load time; both registrations are rejected. This avoids subtle override behavior.
- Namespacing: track ids inside a mod MUST be prefixed by the mod id. The loader validates `track.id.startsWith(mod.id + "/")` before registering. This is mechanical: it cannot be circumvented, and it makes mod-vs-core ids impossible to collide.
- Disable / enable: a separate `localStorage` key `vg2.mods.enabled` holds a `{ [id]: boolean }` map. The loader skips disabled mods. Default for first-load of any newly discovered mod: enabled.

### Mod loader: validation pipeline

For each mod the loader runs:

1. `fetch(/mods/<id>/mod.json)` → JSON parse → `ModManifestSchema.safeParse`. Failure: skip the mod, log structured error.
2. `manifest.id === <id>` (directory match). Failure: skip the mod.
3. For each path in `contents.tracks`: `fetch` → JSON parse → `TrackSchema.safeParse` → namespace check (`track.id.startsWith(manifest.id + "/")`) → `compileTrack(track)` (errors: skip this track, keep the rest of the mod). Compile warnings are logged but non-fatal.
4. Same pattern for `contents.cars` (`CarSchema`), `contents.upgrades` (`UpgradeSchema`), `contents.aiDrivers` (`AIDriverSchema`).
5. Register each successfully validated entity into the in-memory data registry under its mod-namespaced id.
6. Emit a `ModLoadResult` to telemetry (or console in v0.1): `{ id, ok: bool, errors: string[], counts: { tracks, cars, ... } }`.

The pipeline is sequential per-mod but the outer loop is `Promise.all` across mods to keep startup latency bounded by the slowest mod's network fetch.

A "safe mode" flag (`VG_MODS_SAFE=1` in env, or a settings checkbox in the menu) restricts loading to mods whose `license` is SPDX (no `CUSTOM`) AND whose `originalityStatement` is at least 80 characters. Safe mode is the default for the public mod browser when it ships; in v1.0 it is opt-in via settings.

### Mod loader: in-memory registry

```ts
interface DataRegistry {
  tracks: Map<string, Track>;        // namespaced id -> Track
  cars: Map<string, Car>;
  upgrades: Map<string, Upgrade>;
  aiDrivers: Map<string, AIDriver>;
  championships: Map<string, Championship>;
  modIndex: Map<string, ModManifest>; // mod id -> manifest (for credits screens)
}
```

Built at app boot. Core content registers first under the synthetic mod id `core` (no manifest required for core). Then mods register on top. The registry is read-only after boot; reload-the-page is the v1.0 workflow for changing the mod set. Hot-reload is filed as a followup (see below).

### Mod loader: testing

Unit tests with mocked `fetch`:

- Loader handles a missing `mod.json` (404) by logging and skipping.
- Loader rejects a manifest with empty `originalityStatement`.
- Loader rejects a manifest where `id` differs from the directory name.
- Loader rejects a track whose id does not start with `mod.id + "/"`.
- Loader handles a malformed `weatherOptions` track by skipping that track but registering the rest of the mod.
- Two mods with conflicting track ids both fail to register that track.
- Disabled mods (per localStorage) are not fetched.
- Safe-mode rejects `license: "CUSTOM"`.

Playwright e2e:

- Place a fixture mod under `public/mods/test-mod/` in a fixtures directory before test, run a race using a track from that mod, assert the track loads.

### Decisions

1. Modding is Phase 5; both editor and loader are gated by env feature flags until then.
2. Editor is a `/dev/track-editor` page (dev-only) producing the same Track JSON the compiler consumes. No parallel data format.
3. Editor uses a two-pane (segments, preview) layout with a metadata header. Keyboard-driven cell editing; up/down buttons for reordering; no drag-and-drop in MVP.
4. Editor re-uses `<RoadCanvas />` and `compileTrack()` directly. No duplicate validation or duplicate render.
5. Editor has no localStorage persistence in MVP. Import / export via `<input type="file">` and `Blob` download.
6. Mod manifest schema lives in `src/data/schemas.ts` next to existing Track / Car / Upgrade schemas. Required: `id, name, version, schemaVersion=1, author, license, originalityStatement, contents`.
7. Mods live at `public/mods/<id>/` (must be under Next.js `public/` for static asset routing). A build-time script writes `public/mods/index.json` to avoid filesystem access in the browser.
8. Track ids inside a mod MUST be prefixed by mod id. Conflicts produce hard errors; no silent override.
9. Loader is `Promise.all`-parallel across mods, sequential within a mod. Failed mods do not crash boot; they log and skip.
10. Safe mode (env or settings) restricts to SPDX-licensed mods with `originalityStatement >= 80` chars. Off by default in v1.0; on by default for the future public mod browser.
11. Mod ordering is deterministic by id; no per-mod override mechanism. Hot-reload is a followup.
12. CC-BY-SA-4.0 is the recommended license for mod-bundled track / data per §26 ("Track/community data: CC BY-SA 4.0"); CC-BY-4.0 for art / audio. The MODDING.md doc lists this matrix.

### Refinements to existing dots

- `implement-modding-md-efbf1c83` (MODDING.md) should reference this research's manifest schema and the directory layout (`public/mods/<id>/mod.json`), the SPDX vs CUSTOM rule, the namespacing rule, and the safe-mode definition. Updated below.
- `implement-mvp-track-0e1b2918` is unchanged: it lives under `src/data/tracks/` (core content), not `public/mods/`. The mod loader registers core under the synthetic id `core` from the existing core path.

### New implement dots produced

Two new implement dots are created from this research (filed via `dot add`):

1. **implement: track editor (dev page) per §26** — the `/dev/track-editor` page, two-pane layout, keyboard editing, import/export, live preview. Phase 5. Depends on `implement-pseudo-3d-d4c30840` (renderer reuse) and `implement-11995c69` (compiler in production form).
2. **implement: mod loader + manifest schema per §26** — `ModManifestSchema` in `src/data/schemas.ts`, `loadMods()` in `src/data/mods.ts`, `public/mods/index.json` build script, in-memory `DataRegistry`, safe-mode flag. Phase 5. Depends on `implement-licence-files-a7c7b931` (Q-002 resolved so the SPDX list is canonical) and `implement-11995c69` (mod tracks compile through the same pipeline).

### Followups produced

- F-NNN: drag-and-drop segment reordering in the editor. `nice-to-have`. Post-v1.0.
- F-NNN: editor autosave-to-localStorage with a toggle and a "discard local changes" button. `nice-to-have`. Post-v1.0.
- F-NNN: hot-reload mod loader (re-fetch and rebuild the registry without a page refresh). `nice-to-have`. Post-v1.0.
- F-NNN: public mod browser with curation, ratings, and trademark filtering per §26. `polish`. Post-v1.0.
- F-NNN: editor validation for "official-safe" lint mode that rejects risky names per §9 community-tracks rules. `polish`. Phase 5+.

### References

1. `docs/gdd/26-open-source-project-guidance.md` (canonical modding rules).
2. `docs/gdd/22-data-schemas.md` (Track / Car / Upgrade / AI driver schemas the manifest references).
3. `docs/gdd/09-track-design.md` (track anatomy, community track rules).
4. `docs/gdd/21-technical-design-for-web-implementation.md` (mod layer, content folder separation).
5. `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md` (compiler + Track JSON contract that the editor and loader both consume).
6. `src/data/schemas.ts` (existing Zod surface where ModManifestSchema lands).
