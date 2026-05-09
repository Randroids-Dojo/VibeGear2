---
title: "implement: MODDING.md per GDD §26"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T01:22:20.265460-05:00\""
closed-at: "2026-04-29T15:46:41.109742-05:00"
close-reason: "Closed by PR #98 and PR #99: MODDING.md now documents data-only mod layout, manifest fields, validation, licenses, and legal safety per GDD section 26."
blocks:
  - VibeGear2-implement-licence-files-a7c7b931
  - VibeGear2-implement-mod-loader-e9b8b51f
---

## Description

Author `docs/MODDING.md` documenting the v1.0 modding policy and the manifest format.

## Context

§26 ("Open source project guidance") sets the v1.0 modding rules: data-mods only, no executable plugins, manifests must include author / license / originality statement, public mod browser must reject trademark-risk content. The CC-BY-SA-4.0 license recommendation for community track / data is asymmetric with CC-BY-4.0 for bundled art / audio; MODDING.md must call this out.

The technical surface (manifest schema, directory layout, loader behaviour, namespacing rules, safe mode) is fully specified in the binding "Findings" of `.dots/archive/VibeGear2-research-track-editor-0c0353df.md` and implemented by `implement-mod-loader-e9b8b51f`. This dot writes the human-facing documentation that mirrors that contract.

Depends on `implement-licence-files-a7c7b931` so the SPDX list and the project's own license names are pinned, and on `implement-mod-loader-e9b8b51f` so the documented schema fields exactly match the implemented Zod schema.

## Affected Files

- `docs/MODDING.md` (new): the document. Sections per the spec below.
- `README.md` (existing if present, or create): add a one-line link "Modding: see docs/MODDING.md".

## Document outline (binding)

1. **Status and scope.** v1.0 ships data mods only. No executable code. Modding is opt-in via `NEXT_PUBLIC_VG_FEATURE_MODS=1` until the public browser ships.
2. **Directory layout.** `public/mods/<mod-id>/mod.json` plus content folders (`tracks/`, `cars/`, `upgrades/`, `aiDrivers/`, optional `art/`, `audio/`).
3. **Manifest schema.** Document every field of `ModManifestSchema` from `src/data/schemas.ts` with type, requirement, and rationale.
4. **Required fields and why.** Per §26: `author`, `license`, `originalityStatement` are mandatory; the loader rejects mods missing any of them.
5. **License matrix.** Recommend CC-BY-SA-4.0 for community track / data, CC-BY-4.0 for art / audio, MIT or Apache-2.0 if a mod includes shareable utility code (rare). Explain the BY-vs-BY-SA asymmetry.
6. **Namespacing rules.** Track, car, upgrade, and AI driver ids inside a mod MUST be prefixed by the mod id (`mymod/loop`, never `loop`). Loader rejects unprefixed ids.
7. **Originality statement guidance.** Examples of acceptable statements ("All track JSON authored by me; sky texture sourced from Pexels under CC0; engine SFX recorded by me"). Examples of unacceptable patterns (silent-borrowed assets, "I think this is original" hedge).
8. **Safe mode.** What it is, how to turn it on, what it filters out (CUSTOM-licensed mods, short originality statements). Default for the public browser when it ships.
9. **Conflict and load order.** Lexicographic by mod id; conflicts on the same namespaced id reject both.
10. **Limits.** What mods cannot do in v1.0: replace core game logic, override core tracks, add new physics, ship binaries, embed remote URLs that the loader follows.
11. **Cookbook.** Walkthrough of building "my first mod" using the dev track editor (link to `/dev/track-editor` once shipped).
12. **Trademark and IP rules.** Cross-link to LEGAL_SAFETY.md (`implement-legal-safety-77d61769`) for the patterns to avoid; reiterate "no Top Gear assets, names, or soundalikes" from §26.
13. **Submitting a mod.** For now: open a PR adding the directory under `public/mods/`. Future: the public mod browser.

## Edge Cases

- The MODDING.md doc must NOT include any em-dashes (per WORKING_AGREEMENT.md house style).
- Examples that show JSON must validate against `ModManifestSchema` (paste them into a Vitest "doc-examples" test if practical, or hand-verify).
- Ensure license names are SPDX-correct (`CC-BY-4.0` not `CC BY 4.0`) when listed as code values; the prose can use the human-readable form.

## Verify

- [ ] `docs/MODDING.md` exists with the section list above.
- [ ] Every JSON example in the doc parses against the implemented `ModManifestSchema`.
- [ ] Cross-links to `LEGAL_SAFETY.md` and `CONTRIBUTING.md` resolve.
- [ ] No em-dashes or en-dashes anywhere in the file.
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `.dots/archive/VibeGear2-research-track-editor-0c0353df.md` (manifest schema, namespacing, safe mode).
- `docs/gdd/26-open-source-project-guidance.md` (canonical modding rules and license matrix).
