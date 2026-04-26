# Progress Log

Append a new entry at the **top** of this file at the end of every loop. Use
the template from `IMPLEMENTATION_PLAN.md` §6. Never delete past entries —
correct them by adding a new entry that references the old one.

---

## 2026-04-26: Slice: Add Playwright e2e harness and title-screen smoke

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/playwright-smoke` (off `feat/scaffold-next-app`), PR pending
**Status:** Implemented

### Done
- Added `@playwright/test` 1.48 as a devDependency.
- Authored `playwright.config.ts`: chromium project, runs against
  `http://127.0.0.1:3100` (configurable via `PLAYWRIGHT_PORT`), boots the
  Next.js production build via `npm run build && npm run start`, retains
  HTML reports + traces + screenshots on failure, GitHub reporter under CI.
- Authored `e2e/title-screen.spec.ts`: a single smoke test that loads `/`,
  asserts the `data-testid="game-title"` element reads "VibeGear2", asserts
  the document title matches, asserts the three menu buttons (Start Race,
  Garage, Options) are visible and disabled, and asserts the build status
  contains "Phase 0".
- Added npm scripts `test:e2e`, `test:e2e:ui`, and `verify:full`
  (`verify` + `test:e2e`).
- Updated `vitest.config.ts` exclude pattern from `tests/e2e/**` to `e2e/**`
  to match the chosen folder.
- Updated `README.md` Local development block to document
  `npx playwright install chromium`, `npm run test:e2e`, and `npm run
  verify:full`.

### Verified
- `npm install` succeeds.
- `npx playwright install chromium` succeeds.
- `npm run lint`, `npm run typecheck`, `npm run test` all pass.
- `npm run test:e2e` builds and starts the production server, runs the smoke
  spec, and passes (1 passed, ~7s wall).
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Ran Playwright against the production build, not the dev server. Reasons:
  the production build is what auto-deploy will ship, the smoke check
  catches build regressions earlier, and dev-server hot-reload occasionally
  emits transient 500s during compilation that flake e2e tests.
- Pinned the e2e port to 3100 (configurable) rather than 3000 so a local
  `npm run dev` session does not collide with `npm run test:e2e`.
- Restricted to chromium for the smoke. Cross-browser projects (firefox,
  webkit, mobile) ship in a later slice once Phase 0 closes; chromium alone
  is sufficient to prove the harness wiring.
- Branched off `feat/scaffold-next-app` rather than `main` because the
  scaffold slice is not merged yet and the Playwright smoke can only be
  verified end-to-end with the app shell present. Will rebase if scaffold
  merges first.

### Followups created
- None new. F-002 advanced: only the GitHub Actions CI sub-slice remains
  open (still blocked by Q-003).

### GDD edits
- None.

---

## 2026-04-26: Slice: Scaffold Next.js + TypeScript app shell

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/scaffold-next-app`, PR pending
**Status:** Implemented

### Done
- Stood up the Next.js 15 (App Router) + React 18 + TypeScript 5 strict
  project skeleton at the repo root: `package.json`, `tsconfig.json` with
  strict + `noUncheckedIndexedAccess` + `@/*` path alias, `next.config.mjs`
  with `outputFileTracingRoot` and typed routes, `.eslintrc.json` extending
  `next/core-web-vitals` and `next/typescript`, `.gitignore` covering the
  Next/Node/Playwright artefact paths plus `.dots/`.
- Added the App Router skeleton: `src/app/layout.tsx`, `src/app/page.tsx`
  (title screen with disabled menu placeholders for Start Race, Garage,
  Options, plus a `data-testid="game-title"` hook for the upcoming Playwright
  smoke), `src/app/globals.css`, and `src/app/page.module.css`.
- Created the Phase 0 stub layout for the runtime modules under §21's
  recommended structure: `src/game/`, `src/road/`, `src/render/` each with an
  `index.ts` barrel referencing §21. Added `src/game/raceState.ts` with a
  typed `createRaceState` constructor and three Vitest unit tests
  (`raceState.test.ts`) so the test harness exercises real code from day one.
- Added Vitest 2 unit harness via `vitest.config.ts` (node environment,
  `src/**/*.test.ts` discovery, `@/*` alias mirror, v8 coverage), and npm
  scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`,
  `verify` (lint + typecheck + test).

### Verified
- `npm install` succeeds (436 packages, no peer-dep failures).
- `npm run lint` passes with zero warnings.
- `npm run typecheck` passes (`tsc --noEmit`, strict).
- `npm run test` runs 3 unit tests, all green.
- `npm run build` produces an optimised production build, prerenders `/`
  statically (102 kB First Load JS).
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Resolved Q-001: §21 is fully authored, so the slice adopts the recommended
  layered architecture verbatim. Picked Next.js 15 (latest stable App Router)
  rather than 14 because §21 specifies "Next.js" without pinning a major and
  the canary tooling still works under 15.
- Picked React 18 over React 19 deliberately: §21 says "Reuse VibeRacer
  patterns" and React 18 is the current LTS-equivalent for Next.js + Vitest +
  jsdom; revisit when Phase 1 needs concurrent features.
- Deferred Playwright e2e harness to its own slice (`implement: add
  Playwright e2e harness and title-screen smoke`) so this slice stays
  PR-sized.
- Deferred CI / auto-deploy to its own slice (`implement: GitHub Actions CI
  + auto-deploy`), still blocked by Q-003.
- Excluded `.dots/` from version control: the dots task tracker is a
  per-developer working artefact, not a build input.
- Marked the title-screen menu items disabled rather than wired-up: the
  routes do not exist yet, and Phase 0 only owes a title screen.

### Followups created
- None new. F-001 marked `done` (sections 18 to 28 already exist; the
  followup was based on a stale assumption). F-002 advanced to `in-progress`:
  remaining slices are Playwright smoke and GitHub Actions CI.

### GDD edits
- None.

---

## 2026-04-26 — Slice: Bootstrap implementation plan and working agreement

**GDD sections touched:** none (meta)
**Branch / PR:** `claude/gdd-implementation-plan-Z0cpN`, PR pending
**Status:** Implemented

### Done
- Added `docs/IMPLEMENTATION_PLAN.md` describing phases, the per-loop
  workflow, slice selection rules, definitions of done, and stopping
  conditions.
- Added `docs/WORKING_AGREEMENT.md` describing branching, commits, PRs,
  auto-deploy expectations, verification rules, clarification protocol, and
  risky-action gates.
- Seeded `docs/PROGRESS_LOG.md`, `docs/OPEN_QUESTIONS.md`, and
  `docs/FOLLOWUPS.md` so subsequent loops have a place to write.

### Verified
- Manual review of the four documents for internal consistency and against
  `GDD.md` section list.

### Decisions and assumptions
- Treated `GDD.docx` as a historical artefact; Markdown is canonical.
- Assumed Next.js + TypeScript + Canvas2D stack as implied by
  `01-title-and-high-concept.md` and `21-technical-design-for-web-implementation.md`
  (the latter is not yet authored — flagged as Q-001).
- Chose squash-merge as the default merge strategy, reversible by dev request.

### Followups created
- F-001 Author the eleven missing GDD sections (18–28) before Phase 0 can
  close.
- F-002 Stand up the Next.js + TypeScript project skeleton with CI and a
  deploy target.
- F-003 Wire an auto-deploy pipeline from `main`.

### GDD edits
- None.
