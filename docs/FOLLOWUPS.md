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
**Status:** open
**Notes:** Blocked by Q-003 (deploy target). Once chosen, add CI workflow
that builds, runs the test suite, and deploys on every merge to `main`.

## F-002 — Project skeleton (Next.js + TypeScript + CI)
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** open
**Notes:** First implementation slice once Q-001 is answered. Must include
lint, type-check, unit tests, e2e harness, and a smoke test that the dev
server boots.

## F-001 — Author GDD sections 18–28
**Created:** 2026-04-26
**Priority:** blocks-release
**Status:** open
**Notes:** `GDD.md` lists 28 sections; only 01–17 currently exist as files.
Draft the remaining sections (18 Sound and Music, 19 Controls and Input,
20 HUD and UI/UX, 21 Technical Design, 22 Data Schemas, 23 Balancing Tables,
24 Content Plan, 25 Development Roadmap, 26 Open Source Project Guidance,
27 Risks and Mitigations, 28 Appendices) from cross-references and flag
unresolved spots for dev review. Each section should land in its own slice.
