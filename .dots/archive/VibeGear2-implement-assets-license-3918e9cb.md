---
title: "implement: ASSETS-LICENSE file + asset license fields in manifests per Q-002 §26"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:16:02.219486-05:00\\\"\""
closed-at: "2026-04-26T04:08:28.683705-05:00"
close-reason: verified
---

## Description

Add `ASSETS-LICENSE` (root) declaring CC-BY-4.0 (or final answer to Q-002) for original art / SFX / music. Add a `license` field to the asset manifest schema and require it on every asset entry. §26 'Avoiding IP contamination' demands a designated LEGAL_SAFETY.md (sibling dot) plus an explicit asset license file.

## Context

GDD source of truth: `docs/gdd/26-open-source-project-guidance.md` ('Suggested licenses' table), `docs/OPEN_QUESTIONS.md` Q-002 (recommended default: CC-BY-4.0 for assets, MIT for code). Sibling dot `implement-licence-files-...` handles the code license; this dot owns the asset side.

## Affected Files

- `ASSETS-LICENSE` (new): copy CC-BY-4.0 verbatim or a project SPDX header pointing at it
- `src/asset/manifest.ts` (update): require `license` field on each entry; type union of `'CC-BY-4.0' | 'CC0' | 'CC-BY-SA-4.0' | 'public-domain'`
- `src/asset/__tests__/manifest.test.ts` (update): every shipped manifest entry has a license
- `docs/OPEN_QUESTIONS.md` (update): mark Q-002 answered with the chosen licenses
- `scripts/content-lint.ts` (update if present, else add to its dot): flag any new asset without license metadata

## Edge Cases

- Mixed-license manifests: allowed, but every entry must declare its own license.
- Mod-loaded assets: their manifests live outside src/; the loader rejects manifests missing a license field.
- Track / car JSON authored under CC-BY-SA-4.0 (data, per §26): document the chosen data license at the top of each track file.

## Verify

- [ ] `ASSETS-LICENSE` exists at repo root.
- [ ] Every asset entry has a `license` field per the manifest test.
- [ ] OPEN_QUESTIONS.md marks Q-002 answered with the selected licenses.
- [ ] Mod loader (when implemented) rejects manifests missing license.
- [ ] No em-dashes.
- [ ] PROGRESS_LOG.md entry added.
