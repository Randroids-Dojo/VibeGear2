---
title: "implement: content lint script (scripts/content-lint.ts) per LEGAL_SAFETY.md §9"
status: closed
priority: 4
issue-type: task
created-at: "\"2026-04-26T01:45:22.647447-05:00\""
closed-at: "2026-04-26T13:29:14.967049-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Author `scripts/content-lint.ts`, a build-gating script that fails the build when contributed content violates the IP-drift checklist defined in `docs/LEGAL_SAFETY.md` §9. Wire it into `npm run verify` and CI so legal-safety enforcement is automated, not just paperwork. Closes the GDD §27 "content linting" mitigation for Legal / IP drift.

## Context

GDD §27 names "content linting" as one of three mitigations for legal / IP drift. `implement-legal-safety-77d61769` §9 specifies the lint contract:

> Behaviour expected: fail the build if (a) any binary in `public/` is missing a manifest entry, (b) any track JSON references a real-circuit name from a small denylist (`nurburgring`, `spa`, `suzuka`, `monza`, `silverstone`, `imola`, `estoril`, etc.), (c) any car name matches a manufacturer denylist, (d) any text content matches a "Top Gear" denylist.

LEGAL_SAFETY.md defers the script to a follow-up. This dot is that follow-up. The script lives in `scripts/` (matches the existing `scripts/build-mods-index.ts` location named in `implement-mod-loader-e9b8b51f`).

Depends on `implement-legal-safety-77d61769` (the document defines the contract this script enforces) and `implement-licence-files-a7c7b931` (the asset manifest format is defined in that slice). Blocks `implement-tagged-release-b3d30084` because the §27 mitigation must be live before v0.1 ships.

## Affected Files

- `scripts/content-lint.ts` (new): the lint script. Walks `public/`, `src/data/tracks/`, `src/data/cars/`. Reads denylists from `scripts/content-denylists.json`. Exits non-zero on violations.
- `scripts/content-denylists.json` (new): three lists. Schema: `{ realCircuits: string[], carManufacturers: string[], topGearTrademarks: string[] }`. Initial content from LEGAL_SAFETY.md §9 examples plus reasonable expansions (e.g. additional manufacturers: ferrari, porsche, toyota, ford, etc.). Document the rationale for each list at the top of the JSON file via a `"_comment"` field.
- `scripts/__tests__/content-lint.test.ts` (new): unit tests with fixtures under `scripts/__tests__/fixtures/`. Each fixture exercises one rule. The test runs the lint function in isolation against the fixture tree, not against the real repo.
- `package.json` (existing): add `"lint:content": "tsx scripts/content-lint.ts"` and chain it from `verify` so `npm run verify` fails on a violation.
- `.github/workflows/ci.yml` (existing if present, else update F-002 follow-up): ensure CI runs `npm run lint:content`.
- `docs/LEGAL_SAFETY.md` (existing once `implement-legal-safety-77d61769` lands): cross-reference this script by path and behaviour. Do not duplicate the rules.

## Edge Cases

- A track JSON has a denylist string inside a `description` field but the rest of the file is fine: violation; print the file path and the offending field path.
- A car JSON has a denylist string in the model name: violation.
- A binary in `public/art/` has no asset-manifest entry: violation; print the binary path.
- `public/mods/<id>/` content: skipped by this lint (mod content runs through the mod loader's own validation per `implement-mod-loader-e9b8b51f`).
- The asset manifest itself is missing or unreadable: lint fails with a structured error citing the manifest path.
- Case-insensitive matching: "Ferrari", "FERRARI", "ferrari" all hit the same denylist entry.
- Word-boundary matching: "spada" must NOT match "spa". Use word-boundary regex (`\bspa\b`).
- A denylist string appears inside a comment-style key (e.g. `_comment` or `_note`): treat it as a violation anyway. Comments are not licensed exceptions.
- A denylist false-positive (a genuine non-trademark word that happens to collide): handled by the `// content-lint:allow <reason>` inline override token. Document the override syntax in `docs/LEGAL_SAFETY.md` §9.
- Output is structured JSON when invoked with `--json` (for CI annotations) and human-readable text otherwise.

## Verify

- [ ] `npm run lint:content` returns 0 on the current repo (which has no violating content yet).
- [ ] Adding a fixture car JSON with `name: "Ferrari Apex"` causes `npm run lint:content` to exit non-zero with a clear path-pointing message.
- [ ] All four LEGAL_SAFETY.md §9 rule branches are covered by at least one Vitest fixture test.
- [ ] `npm run verify` runs `lint:content` in its chain and fails the chain on a violation.
- [ ] No em-dashes or en-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.
- [ ] FOLLOWUPS.md F-NNN created if any deferred enhancement (e.g. perceptual hashing of binaries against known Top Gear sprites) is identified during implementation.

## References

- `docs/gdd/27-risks-and-mitigations.md` (Legal / IP drift row).
- `docs/gdd/26-open-source-project-guidance.md` ("Avoiding IP contamination").
- `.dots/VibeGear2-implement-legal-safety-77d61769.md` §9 (the binding contract).
