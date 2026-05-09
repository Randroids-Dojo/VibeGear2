---
title: "implement: CONTRIBUTING.md per GDD §26"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T01:22:17.690051-05:00\\\"\""
closed-at: "2026-04-28T00:57:08.688699-05:00"
close-reason: "Merged PR #37. Addressed and resolved Copilot review thread, main CI and production deploy passed, and production routes returned 200."
blocks:
  - VibeGear2-implement-licence-files-a7c7b931
  - VibeGear2-implement-legal-safety-77d61769
---

## Description

Author `docs/CONTRIBUTING.md` documenting how external contributors propose changes, the originality checklist they must affirm, the inbound = outbound MIT contribution model, and the PR review surface enforced by maintainers.

## Context

GDD §26 ("Open source project guidance") sets the contribution rules:

1. Every PR must confirm original work or correctly-licensed work.
2. No copied Top Gear 2 assets, names, or soundalikes.
3. Any third-party source is documented in the asset manifest.
4. New content passes schema and lint checks.

The licence research (`.dots/archive/VibeGear2-research-licence-selection-4086fb7d.md` §"contribution paperwork") fixes the policy:
- No CLA, no DCO sign-off enforced. MIT inbound = outbound.
- Re-licensing requires unanimous contributor consent (per WORKING_AGREEMENT.md §11 "irreversible without dev confirmation").
- CONTRIBUTING.md must reference the three licence files (`LICENSE`, `ASSETS-LICENSE`, `DATA-LICENSE`) and the originality checklist from §26.

This dot ships the human-facing rulebook. `LEGAL_SAFETY.md` (separate dot, must land first) catalogues the safe/unsafe content patterns; CONTRIBUTING.md links to it rather than duplicating its content.

Depends on `implement-licence-files-a7c7b931` so the three licence file paths and SPDX names are pinned, and on `implement-legal-safety-77d61769` so CONTRIBUTING.md can cross-link to the canonical safe/unsafe pattern catalogue instead of duplicating.

## Affected Files

- `docs/CONTRIBUTING.md` (new): the document, sections per the outline below.
- `README.md` (existing): add a one-line link "Contributing: see docs/CONTRIBUTING.md" if not already present.

## Document outline (binding)

1. **Welcome and scope.** One-paragraph summary of what VibeGear2 is, link to `README.md` and `GDD.md`, statement that the project is community-extensible per GDD §1 and §26.
2. **Code of conduct pointer.** Link to a separate file or note "TBD; treat each other professionally" with a follow-up issue. (Do not block this slice on authoring a full CoC.)
3. **Branch and PR workflow.** Mirror `WORKING_AGREEMENT.md` §2 §3 §4 for external contributors: short-lived `feat/`, `fix/`, `chore/`, `docs/` branches off `main`; one slice per PR; never push to `main`.
4. **Commit message style.** Reproduce the `<type>(<area>): <imperative summary>` template from WORKING_AGREEMENT.md §3, with the allowed `<type>` set: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.
5. **Verification before opening a PR.** `npm run verify` must pass (lint + typecheck + test). Playwright e2e suite must pass for any PR touching gameplay or UI. Note that CI re-runs all of these on push.
6. **PR confirmation checklist.** Required box-tickers, copy verbatim into a PR template (`.github/pull_request_template.md` is out of scope for this slice but will reuse this list):
   - [ ] Original work, or work with a compatible licence noted in the asset manifest.
   - [ ] No Top Gear 2 assets, names, or soundalikes (see `LEGAL_SAFETY.md`).
   - [ ] Any third-party source documented in the asset manifest.
   - [ ] All new content (data, schemas) passes `npm run verify`.
   - [ ] No em-dashes or en-dashes in new files (project house style, AGENTS.md RULE 1).
   - [ ] `PROGRESS_LOG.md` entry added if the slice is structural.
7. **Originality requirement (deep dive).** Define "original work": authored from scratch by the contributor or remixed from a CC0 / CC BY 4.0 / CC BY-SA 4.0 source. Cross-link to `LEGAL_SAFETY.md` for the canonical safe/unsafe pattern catalogue (do not duplicate that content here).
8. **Licensing model (summary, not duplication).** Three sentences: code is MIT (`LICENSE`), original assets are CC BY 4.0 (`ASSETS-LICENSE`), track/community data is CC BY-SA 4.0 (`DATA-LICENSE`). Contributors agree their contribution is licensed under the matching file simply by opening the PR (inbound = outbound). No CLA, no DCO sign-off required. Re-licensing requires unanimous contributor consent.
9. **Asset manifest rules.** Every art / audio / track contribution must add or update an entry in the asset manifest (`public/asset-manifest.json` or wherever the licence-files slice puts it; resolve the path at write-time): contributor, source, licence, originality statement. Maintainer will reject PRs that ship binaries without a manifest entry.
10. **Schema and lint expectations.** Any data file (track / car / upgrade / AI driver / mod manifest JSON) must validate against the matching Zod schema in `src/data/schemas.ts`. The repo's lint config is `next lint`; any new lint warning blocks the PR.
11. **Issue triage and labels.** Reproduce the GDD §26 label list: `physics`, `renderer`, `ai`, `ui-ux`, `audio`, `modding`, `content`, `legal-review`, `good-first-issue`, `help-wanted`, `performance`, `bug`, `design`. Note that `legal-review` is the escalation label per `LEGAL_SAFETY.md`.
12. **First-time contributor walkthrough.** Three-step onboarding: clone, run `npm install && npm run dev`, pick a `good-first-issue` and open a draft PR.
13. **Maintainer expectations.** What the contributor can expect: review within N business days (leave N as TBD with a footnote); maintainer may request changes, squash-merge per WORKING_AGREEMENT.md §4.
14. **Where to ask questions.** GitHub Discussions (or Issues with the `help-wanted` label until Discussions is enabled). Do not paste copyrighted material into issues per `LEGAL_SAFETY.md`.

## Edge Cases

- The doc must NOT include any em-dashes or en-dashes (per WORKING_AGREEMENT.md house style + AGENTS.md RULE 1). Use ASCII hyphens or rephrase.
- If the asset manifest path changes between the licence-files slice and this slice, fix the cross-reference at write-time; do not commit a broken link.
- Do not require contributors to install anything beyond `node` and `npm`. The `npm run verify` and `npm run test:e2e` commands must work out of the box on a fresh clone.
- Do not duplicate any content from `LEGAL_SAFETY.md` or `MODDING.md`; cross-link instead.

## Verify

- [ ] `docs/CONTRIBUTING.md` exists with all 14 sections from the outline.
- [ ] Cross-links to `LICENSE`, `ASSETS-LICENSE`, `DATA-LICENSE`, `LEGAL_SAFETY.md`, `MODDING.md`, `WORKING_AGREEMENT.md`, `GDD.md` resolve.
- [ ] No em-dashes or en-dashes anywhere in the file (`grep -P "[–—]" docs/CONTRIBUTING.md` returns nothing).
- [ ] `README.md` Contributing one-liner present.
- [ ] `npm run verify` is green (no behavioural change, but confirms no markdown lint regression if one is configured).
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `.dots/archive/VibeGear2-research-licence-selection-4086fb7d.md` §"contribution paperwork".
- `docs/gdd/26-open-source-project-guidance.md` (GDD §"Contribution guidelines", §"Suggested issue labels").
- `docs/WORKING_AGREEMENT.md` §2 §3 §4 (branching, commits, PRs).
