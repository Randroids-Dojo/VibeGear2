---
title: "implement: profile export / import (JSON download + upload + versioned restore) per §20"
status: closed
priority: 4
issue-type: task
created-at: "\"2026-04-26T03:22:27.778261-05:00\""
closed-at: "2026-04-26T10:17:25.047355-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-savegamesettings-b948015a
  - VibeGear2-implement-options-screen-a9379c4a
---

## Description

Build the manual profile export and import flow listed under `docs/gdd/20-hud-and-ui-ux.md` Save and load: "Manual profile export / import" plus "Versioned save migrations". Currently the persistence module owns local-storage save and the savegamesettings dot expands the schema; no dot owns the human-driven backup / restore round-trip.

## Context

§20 makes profile export a first-class feature. A player who clears their browser data should be able to restore from a previously-downloaded JSON file. The save schema already has a `version` field for migration; export reuses that. Import must validate strictly (Zod) and refuse malformed or future-version files.

This is also a contributor / QA tool: a developer can hand-craft a save fixture for testing and load it via the same path.

## Affected Files

- `src/persistence/profileExport.ts` (new): pure functions `exportProfile(save) => Blob`, `importProfile(text) => SaveGame | ImportError`. No I/O; the caller owns the file dialog.
- `src/persistence/__tests__/profileExport.test.ts` (new): round-trip a fixture; reject malformed JSON; reject schema-invalid; reject future version; accept current version unchanged; accept past version through the migration chain.
- `src/components/options/ProfileSection.tsx` (new): renders the Profile pane in /options. Buttons: "Export profile", "Import profile" (file picker), "Clear save" (with confirm). Wires to the pure functions plus `URL.createObjectURL` and a hidden `<input type="file">`.
- `src/app/options/page.tsx` (update via options-screen-a9379c4a): mount `<ProfileSection>` inside the Options scaffold.
- `e2e/profile-export.spec.ts` (new): seed save, click Export, intercept download via `page.waitForEvent('download')`, save to tmp; click Clear save (confirm); click Import, supply tmp file via `page.setInputFiles`; assert save state restored.

## Edge Cases

- File too large (>1 MB): reject with friendly error; saves should never approach this size.
- Schema-invalid JSON: surface the Zod error path so the player knows which field broke.
- Future version: reject with "this save was created in a newer version" (do not attempt to downgrade).
- Past version: run the existing migration chain in `src/persistence/save.ts` and accept.
- Empty file or non-JSON text: reject with parse error.
- Import while a race is active: prompt "this will end your current race"; on confirm, abort the race and reload state.
- Import preserving `version`: the imported save's `version` is honored; migration runs the same as a localStorage load.

## Verify

- [ ] Round-trip: `importProfile(exportProfile(fixture)) === fixture` (deep-equal).
- [ ] Schema-invalid JSON returns `{ok: false, error: {kind: "schema", path, message}}`.
- [ ] Malformed JSON returns `{ok: false, error: {kind: "parse"}}`.
- [ ] Future version returns `{ok: false, error: {kind: "future_version", saveVersion, runtimeVersion}}`.
- [ ] Past version: a v1 save imports cleanly into a runtime expecting v2 (migration applies).
- [ ] >1 MB text returns `{ok: false, error: {kind: "too_large"}}`.
- [ ] Export Blob has MIME `application/json` and a stable filename pattern (`vibegear2-profile-<timestamp>.json`).
- [ ] Playwright e2e covers the full export / clear / import round-trip.
- [ ] Import while racing prompts confirm; abort path leaves the race untouched.
- [ ] Pure: `exportProfile` and `importProfile` have no DOM / Storage side effects (only the React component does).
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/persistence/profileExport.ts src/components/options/ProfileSection.tsx e2e/profile-export.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/20-hud-and-ui-ux.md` Save and load
- `docs/gdd/22-data-schemas.md` Save-game JSON schema
- `docs/gdd/21-technical-design-for-web-implementation.md` (persistence stack)
