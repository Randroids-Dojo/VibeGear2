---
title: "implement: licence files + package.json licence field + Q-002 resolution"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"\\\\\\\"\\\\\\\\\\\\\\\"\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"2026-04-26T01:21:41.995909-05:00\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\"\\\\\\\\\\\\\\\"\\\\\\\"\\\"\""
closed-at: "2026-04-26T18:29:23.526652-05:00"
close-reason: "Completed licence finalisation: added DATA-LICENSE, package MIT field, README Licensing section, Q-002 cleanup, and legal safety link. Verified npm run verify, diff check, and dash scan."
---

## Description
Land the project's licence triplet so the repo is safe to publish, and resolve Q-002.

## Context
Per research findings in `.dots/VibeGear2-research-licence-selection-4086fb7d.md`:
- Code under MIT (broadest reuse, no NOTICE ceremony, matches the MIT-class JS/TS dependency stack).
- Original art + music/SFX under CC BY 4.0 (attribution preserved per GDD §18; remixable per §26).
- Track + community data under CC BY-SA 4.0 (project-compatible data licence per §26 row 4; share-alike protects community balance work).
GDD §26 explicitly authorises the code + art rows. The asymmetry between BY (assets) and BY-SA (data) is deliberate, see findings.

WORKING_AGREEMENT.md §11 treats licence changes as irreversible without dev confirmation. Land the files before the first external contribution.

## Affected files
- `LICENSE` (new): verbatim MIT text, copyright "(c) 2026 VibeGear2 contributors".
- `ASSETS-LICENSE` (new): verbatim CC BY 4.0 deed + scope note covering `public/art/`, `public/audio/`, `assets/`. State that third-party assets keep upstream licences and are tracked in the asset manifest.
- `DATA-LICENSE` (new): verbatim CC BY-SA 4.0 deed + scope note covering `src/data/**` and `public/mods/**`.
- `package.json`: add `"license": "MIT"`.
- `README.md`: add a "Licensing" section linking the three files and naming the asymmetry (code MIT, assets CC BY 4.0, data CC BY-SA 4.0).
- `docs/OPEN_QUESTIONS.md`: flip Q-002 from `open` to `answered`, add a `Resolution.` block citing the licence files and this slice's PR.
- `docs/PROGRESS_LOG.md`: standard slice entry per IMPLEMENTATION_PLAN.md §6.

## Out of scope (file separate dots if needed)
- `LEGAL_SAFETY.md` content (GDD §26 calls for it, separate slice).
- `CONTRIBUTING.md` and `MODDING.md` (separate slices).
- Mod manifest schema `attribution` field (separate slice, blocked by data-schemas work).
- DCO sign-off enforcement / CLA decision (none required; documented in research findings).

## Verify
- `grep -rn $'—' LICENSE ASSETS-LICENSE DATA-LICENSE README.md docs/OPEN_QUESTIONS.md` returns nothing (em-dash check per AGENTS.md RULE 1).
- Each licence file contains the official deed text, not a paraphrase.
- `npm run verify` is green (no behavioural change, but confirms package.json edit didn't break tooling).
- Q-002 in OPEN_QUESTIONS.md shows `Status: answered` and a Resolution block.
- README.md Licensing section links all three files with the correct scope summary.

## Researcher Status Check (iter-27)

Verified on branch `feat/assets-license` at HEAD `c4b1303`. Iter-26's PROGRESS_LOG entry claimed "Implemented / Followups created: None" but this dot's scope is only partially landed. Remaining work confirmed via direct filesystem and git checks:

- [ ] **`LICENSE` is untracked, not committed.** File exists on disk (1.1K, MIT text) but `git status` shows it under "Untracked files" on `feat/assets-license`. Recovery: `git add LICENSE` and commit with the assets-licence batch (or in a follow-up `chore(legal): add MIT LICENSE` commit).
- [ ] **`DATA-LICENSE` does not exist.** `ls /Users/randroid/Documents/Dev/VibeGear2/DATA-LICENSE` returns "No such file or directory". Per dot scope: verbatim CC BY-SA 4.0 deed + scope note covering `src/data/**` and `public/mods/**`. Recovery: create the file with the official CC BY-SA 4.0 deed text (not a paraphrase, per Verify clause).
- [ ] **`package.json` is missing the `"license"` field.** Inspected at `/Users/randroid/Documents/Dev/VibeGear2/package.json`; only `"name": "vibegear2"` and `"version": "0.0.0"` are present near the top — no `"license"` key. Recovery: add `"license": "MIT"` and run `npm run verify` to confirm tooling is unaffected.
- [ ] **`README.md` has no Licensing section.** `grep -in 'licens' README.md` returned zero matches. Recovery: add a "Licensing" section linking `LICENSE`, `ASSETS-LICENSE`, `DATA-LICENSE` and naming the asymmetry (code MIT, assets CC BY 4.0, data CC BY-SA 4.0).
- [ ] **`docs/OPEN_QUESTIONS.md` Q-002 not flipped.** Out of scope to verify here, but flagged for the implementer: dot's scope requires Q-002 to flip `open` → `answered` with a Resolution block citing the licence files and the closing PR.

Partial progress already landed (do NOT redo):
- `ASSETS-LICENSE` shipped in commit `c4b1303` along with manifest licence type/runtime guard and 5 unit tests — confirmed via `git log --oneline -3 feat/assets-license`.

Dot remains `status: active` until all five boxes above are checked. The PROGRESS_LOG entry from iter-26 should be amended in a future iteration to reflect partial-implementation status, or a fresh PROGRESS_LOG entry should be added when the remaining items land.
