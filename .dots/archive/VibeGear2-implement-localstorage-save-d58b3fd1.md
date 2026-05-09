---
title: "implement: localStorage save/load (versioned) per §21"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:11.114186-05:00\\\"\""
closed-at: "2026-04-26T01:17:11.524865-05:00"
close-reason: "Added src/persistence/save.ts (loadSave, saveSave, defaultSave) + migrations registry + barrel. Versioned key vibegear2:save:v1, corrupted/schema-invalid payloads preserved under :backup before fallback. 19 unit tests over an in-memory Storage shim cover all failure paths (no-storage, missing, corrupted-json, schema-invalid, future-major, quota-exceeded, getItem-throws). 45 total tests passing. Filed F-004 for the garage-driven Playwright reload test once the Phase 2 garage UI exists."
blocks:
  - VibeGear2-implement-data-schemas-4dd373bc
---

## Description

Implement a versioned localStorage save module. Reads, validates with the SaveGame Zod schema, runs migrations on version mismatch, writes back. Single-key storage at `vibegear2:save:v1` (the `v1` reflects the current schema major).

## Context

Phase 2 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/21-technical-design-for-web-implementation.md` §save system. SaveGame schema lives in §22. `docs/WORKING_AGREEMENT.md` §11 requires dev confirmation before dropping or renaming persisted save fields.

## Affected Files

- `src/persistence/save.ts` (new): `loadSave()`, `saveSave(state)`, `migrate(raw)`
- `src/persistence/__tests__/save.test.ts` (new): valid load, invalid JSON falls back to default, migration path stub
- `src/persistence/migrations/index.ts` (new): empty migrations registry, ready for future versions

## Edge Cases

- localStorage quota exceeded: catch and surface a non-fatal error.
- localStorage unavailable (privacy mode): fall back to in-memory save (no persistence) with warning.
- Corrupted JSON: log and use default save, do not crash.
- Schema validation fails: same as corrupted; preserve raw under `vibegear2:save:backup` for forensic recovery.

## Verify

- [ ] Unit tests cover load, save, corrupted-JSON fallback, and quota error.
- [ ] Save persists across page reloads (Playwright test).
- [ ] Manual privacy-mode test: app does not crash.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
