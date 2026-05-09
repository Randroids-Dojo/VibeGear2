---
title: "implement: docs/CONTRIBUTING and AGENTS sync + npm scripts catalogue + local dev troubleshooting per GDD §26"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T02:09:21.394115-05:00\\\"\""
closed-at: "2026-04-29T19:23:16.986929-05:00"
close-reason: "Merged PR #110 and PR #111, resolved review threads, main CI green, production smoke passed at bca8c28."
blocks:
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Three small, related documentation deliverables that close the
onboarding / dev-experience gap. None of them ship game logic; together
they make a fresh-clone first-hour experience deterministic.

1. **CONTRIBUTING <-> AGENTS sync.** `docs/CONTRIBUTING.md` (shipped by
   `implement-contributing-md-0df67cce`) and `AGENTS.md` (already at repo
   root) overlap on branching, commit style, verify steps, and house style
   rules. Without a sync mechanism they drift. This slice adds a single
   shared source-of-truth section and a one-screen automated check.
2. **npm scripts catalogue.** A new `docs/SCRIPTS.md` lists every script in
   `package.json` with one-line purpose, when to run it, and what failure
   indicates. The Quick pre-commit checklist in AGENTS.md cross-links to it.
3. **Local dev troubleshooting.** A new `docs/LOCAL_DEV.md` documents the
   five most common local-dev failure modes (wrong Node version, port 3000
   busy, npm cache corruption on macOS, jsdom missing peer dep, Playwright
   browsers not installed) with the canonical fix per failure.

## Context

GDD §26 "Open source project guidance" calls for a contribution guide and
a contributor onboarding flow. The CONTRIBUTING dot covers the policy
surface; this dot covers the "how do I run anything" surface.

`AGENTS.md` and the upcoming `CONTRIBUTING.md` will both restate branch and
commit conventions. Restating is fine for redundancy, but the two files
must not contradict each other. The sync mechanism is a small assertion
script (`scripts/check-doc-parity.ts`) that pulls the canonical lines from
`WORKING_AGREEMENT.md` and asserts they appear (string-equal) in both
`AGENTS.md` and `docs/CONTRIBUTING.md`. The script runs in CI and is the
gate.

The scripts catalogue and troubleshooting doc are pure text; they are
included here so the slice ships one coherent dev-experience pass and a
human onboarding cold-start has a single PR to point at.

## Affected Files

- `docs/SCRIPTS.md` (new): one heading per `package.json` script.
  Required entries (current, plus those landing in
  `implement-ci-bundle-57af4a04`):
  - `dev`: starts the Next.js dev server on `:3000`. Watch for HMR errors
    as the canary; a hot-reload that does not pick up a file edit usually
    means the file is gitignored.
  - `build`: production Next.js build. Output in `.next/`.
  - `start`: serves the built app on `:3000`. Required for Lighthouse and
    axe gates.
  - `lint`: `next lint`. Run before pushing; CI will reject any lint
    warning per WORKING_AGREEMENT §6.
  - `typecheck`: `tsc --noEmit`. Strict TypeScript per `tsconfig.json`.
  - `test`: Vitest. Unit tests for `src/game/`, `src/persistence/`,
    `src/data/`.
  - `test:watch`: same with re-runs.
  - `verify`: composite of lint + typecheck + test. Required before any
    commit.
  - `verify:full` (after `implement-ci-bundle-57af4a04`): composite of
    `verify` + bundle budget + Lighthouse + axe.
  - `bundle:budget`, `lighthouse:ci`, `axe:ci` (after the same dot):
    one-line purpose each.
  - When to run each: as a quick reference table at the bottom. Local
    edit: `npm run verify`. Pre-PR: `npm run verify:full`. CI runs all of
    them.
- `docs/LOCAL_DEV.md` (new):
  - **Required Node version.** `>=20`. `nvm use` reads `.nvmrc` once that
    file lands (out of scope here; F-NNN if missing).
  - **First-time clone.** `npm ci` (not `npm install`) for reproducible
    installs.
  - **Port 3000 busy.** `lsof -i :3000`; `kill <pid>`. Document that Next.js
    auto-falls-back to `:3001` but `next start` does not.
  - **macOS npm cache corruption.** `rm -rf node_modules
    ~/.npm/_cacache && npm ci`.
  - **jsdom peer warning on Vitest install.** Expected; Vitest 2 names
    jsdom as an optional peer.
  - **Playwright browsers missing.** `npx playwright install chromium`.
    Required for the e2e suite and the axe / Lighthouse gates.
  - **Build is fine but title screen is blank.** Check
    `NEXT_PUBLIC_BUILD_ID` is not literally `undefined` in the page
    source; if it is, the build was run outside a git repo without the
    `GIT_SHA` env fallback set.
  - **`grep` for em-dashes returns hits in node_modules.** Expected; the
    rule is for repo source only. The pre-commit grep in AGENTS.md
    excludes `node_modules` and `.next` already.
- `scripts/check-doc-parity.ts` (new): reads
  `WORKING_AGREEMENT.md`, `AGENTS.md`, `docs/CONTRIBUTING.md`. Asserts a
  hard-coded list of canonical strings (e.g. the commit message format
  template, the branch naming format, the no-em-dash rule) appears
  verbatim in each. Exits non-zero with a diff on mismatch.
- `package.json` (modify): add `docs:check` script invoking the parity
  script.
- `.github/workflows/*.yml` (modify or new): add `npm run docs:check` as
  a CI step.
- `AGENTS.md` (modify): the Quick pre-commit checklist gains a "See
  docs/SCRIPTS.md for full script reference" link and a "See
  docs/LOCAL_DEV.md when something refuses to run" link.

## Edge Cases

- The parity check rejects re-wording of canonical sentences; the dev
  must update the canonical source (`WORKING_AGREEMENT.md`) and rerun
  the check. Document so a contributor doing a docs polish does not get
  blocked confused.
- New scripts added by future slices must be listed in `SCRIPTS.md` in
  the same PR. Add a comment to `package.json`'s `scripts` block (the
  Next.js convention permits a `// "comment"` field but JSON does not;
  use a separate `docs/SCRIPTS.md` cross-link in the slice template
  instead).
- `LOCAL_DEV.md` must NOT include macOS-specific advice that breaks Linux
  / Windows. Each fix is annotated with the platform when it diverges
  ("macOS" / "Linux" / "Windows").
- The doc-parity script is intentionally simple (string-equal); a smarter
  AST-aware comparator is out of scope. If a contributor needs more
  flexibility, they update `WORKING_AGREEMENT.md` and rerun the check.

## Verify

- [ ] `docs/SCRIPTS.md` lists every script in `package.json` (the parity
      script can do a sanity check on this; expand the script).
- [ ] `docs/LOCAL_DEV.md` has the seven failure modes with canonical fixes.
- [ ] `npm run docs:check` is green on the current `main`.
- [ ] Manually breaking the canonical sentence in `AGENTS.md` makes the
      docs:check red.
- [ ] AGENTS.md cross-links resolve.
- [ ] No em-dashes (U+2014) or en-dashes (U+2013) in added or modified files (`grep -rP
      "[\x{2013}\x{2014}]" docs/SCRIPTS.md docs/LOCAL_DEV.md scripts/check-doc-parity.ts`
      returns nothing).
- [ ] PROGRESS_LOG.md entry added per WORKING_AGREEMENT §6.

## References

- `docs/gdd/26-open-source-project-guidance.md`.
- `AGENTS.md` (Quick pre-commit checklist).
- `docs/WORKING_AGREEMENT.md` (canonical source of truth for the synced
  sentences).
- `.dots/VibeGear2-implement-contributing-md-0df67cce.md` (CONTRIBUTING
  itself).
- `.dots/VibeGear2-implement-ci-bundle-57af4a04.md` (adds scripts that
  must be catalogued).
