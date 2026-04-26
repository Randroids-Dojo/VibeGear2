# Followups

Known followup work that did not fit in the slice that surfaced it. Each
entry has an id (`F-NNN`), a one-line description, the loop that created it,
and a priority.

Priorities: `blocks-release`, `nice-to-have`, `polish`. Statuses: `open`,
`in-progress`, `done`, `obsolete`. Do not delete entries — mark them `done`
or `obsolete` so the trail is preserved.

---

## F-003 — Auto-deploy pipeline from `main`
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** in-progress
**Notes:** Q-003 resolved to Vercel Hobby + GitHub Actions. The
`feat/github-actions-ci` slice landed `.github/workflows/ci.yml` and
`vercel.json`. Marked `done` once the first push to `main` triggers a
successful `deploy` job and the deployed URL serves the title screen. The
human prerequisites (vercel link, repo secrets, branch protection) are
documented in `README.md` Deploy section and in the implement dot.

## F-002 — Project skeleton (Next.js + TypeScript + CI)
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** in-progress
**Notes:** First implementation slice once Q-001 is answered. Must include
lint, type-check, unit tests, e2e harness, and a smoke test that the dev
server boots. App shell, lint (next lint), strict type-check, and the Vitest
unit harness landed in the `feat/scaffold-next-app` slice. Remaining: Playwright
e2e harness with title-screen smoke (own slice), then GitHub Actions CI (own
slice, blocked by F-003 deploy target choice).

## F-001 — Author GDD sections 18–28
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** done
**Notes:** Verified on 2026-04-26 during the scaffold slice: all 28 GDD section
files exist under `docs/gdd/` (01 through 28). The original assumption that
sections 18 to 28 were missing was incorrect at the time this followup was
filed (or had been resolved before any later loop saw it). No action required.
