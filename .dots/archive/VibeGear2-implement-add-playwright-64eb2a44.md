---
title: "implement: add Playwright e2e harness + title-screen smoke (RE-OPENED)"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-26T02:52:03.748631-05:00\\\"\""
closed-at: "2026-04-26T03:04:41.914473-05:00"
close-reason: "verified: playwright harness recovered onto feat/playwright-smoke-recovery (off feat/track-compiler-golden); chose recovery option 2 (re-implement from 693043a artefacts) after option 1 cherry-pick conflicted twice in PROGRESS_LOG.md; lint+typecheck+319 unit tests+build+test:e2e all green; F-002 advanced; PROGRESS_LOG entry added at top with audit trail to prior dot c2ccf4f9"
---

Re-opened: a prior dot (VibeGear2-implement-add-playwright-c2ccf4f9) was closed in iteration 16 with a close-reason claiming the work shipped, but no Playwright artefacts exist in the repo (no playwright.config.ts, no e2e/, no @playwright/test in package.json, no test:e2e script). F-016/F-017/F-018 in docs/FOLLOWUPS.md and F-002 (in-progress) all still defer Playwright work because the harness has not actually landed.

Configure Playwright for end-to-end testing. Add a single smoke test that boots the production build (port 3100, matching the prior dot close-reason), loads /, and asserts the title screen renders. Wire npm run test:e2e and a verify:full alias.

## Context
docs/IMPLEMENTATION_PLAN.md Phase 0 requires an e2e harness. docs/WORKING_AGREEMENT.md §6 requires UI/feel changes to be exercised in a real browser. docs/gdd/21-technical-design-for-web-implementation.md names Playwright explicitly. Three followups (F-016 pause overlay + error boundary, F-017 touch input, F-018 loading screen) are blocked on this harness.

## Affected files
- package.json: add devDep @playwright/test ^1.48.0; add scripts test:e2e (playwright test), test:e2e:ui (playwright test --ui), verify:full (verify && test:e2e)
- playwright.config.ts (new): testDir e2e, baseURL http://127.0.0.1:3100, webServer { command: 'npm run build && npm run start -- --port 3100', port: 3100, reuseExistingServer: !process.env.CI, timeout: 120_000 }, single chromium project, retries: process.env.CI ? 1 : 0
- e2e/title-screen.spec.ts (new): asserts page.locator('[data-testid=game-title]') visible and text contains 'VibeGear2'
- .gitignore: confirm playwright-report/ and test-results/ already ignored (they are)
- README.md: add a one-line E2E section pointing at npm run test:e2e

## Out of scope (separate dots)
- The deferred specs F-016, F-017, F-018 should land in their own slices once this harness exists.
- GitHub Actions CI (separate dot, depends on this).

## Verify
- npx playwright install chromium succeeds locally
- npm run test:e2e boots the production build and asserts the title-screen smoke
- npm run verify:full chains lint + typecheck + vitest + playwright
- e2e/title-screen.spec.ts uses page.goto('/') (no hardcoded port; baseURL handles it)
- No em-dashes or en-dashes in any added file (grep -P '[\\x{2013}\\x{2014}]' returns nothing)
- F-002 advanced toward done in docs/FOLLOWUPS.md
- PROGRESS_LOG.md entry added per IMPLEMENTATION_PLAN.md §6

## Why this re-open
Iteration 16 retro: the loop workflow can drop dot artefacts when an implementer closes a dot without auditing the filesystem. Two dots in this archive closed with rich close-reasons that did not match the repo state (this one + the GitHub Actions CI dot, also re-opened in this iteration). The pattern to watch for: a close-reason that lists files added without those files existing, plus FOLLOWUPS.md entries that still cite the dot's premise as 'not yet landed'.

## Recovery path (iteration 17 finding)
The work for the prior dot does exist on the local branch `feat/playwright-smoke` (commit 693043a 'feat(test): add Playwright e2e harness with title-screen smoke', branched from 554ef04 'feat(app): scaffold Next.js 15 + TypeScript app shell'). The branch was never merged to main and the working tree on every other feature branch (including this iteration's `feat/track-compiler-golden`) does not have the artefacts.

Options for the implementer:

1. **Merge / rebase forward (cheapest).** Cherry-pick or rebase commit 693043a onto the current trunk, resolve any package.json conflicts (later commits added zod and @vitejs/plugin-react), confirm the prod-build webServer port still matches, run `npm run test:e2e` locally, open a PR. Verify the e2e/title-screen.spec.ts asserts current title-screen markup (the title-screen has a `data-testid=game-title` hook per the scaffold-next-app slice).

2. **Re-implement (only if option 1 is broken).** Follow the Affected Files / Verify sections above. Do not invent a new shape; mirror what 693043a delivered so future bisects find one canonical landing.

The implementer MUST add a PROGRESS_LOG.md entry that explicitly notes whether option 1 or option 2 was used, and links the prior closed dot id (VibeGear2-implement-add-playwright-c2ccf4f9) so the audit trail is complete.

## Reviewer checklist (post-merge)
Before closing this dot, confirm against `main` HEAD (not a feature branch):
- [ ] `ls playwright.config.ts e2e/title-screen.spec.ts` both exist on main.
- [ ] `grep '@playwright/test' package.json` returns a hit.
- [ ] `npm run test:e2e` from a clean checkout of main exits 0.
- [ ] F-016, F-017, F-018 in docs/FOLLOWUPS.md are advanced (status `in-progress` or `done`) once their specs are written; if still `open`, that is acceptable so long as the underlying harness is verifiably present.
- [ ] F-002 in docs/FOLLOWUPS.md advanced toward `done`.
