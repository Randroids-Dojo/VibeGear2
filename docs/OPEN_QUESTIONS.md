# Open Questions

Questions the agent has paused on, awaiting dev input. Newest at the top.
Each entry has an id (`Q-NNN`), a GDD reference, the question, options
considered, the agent's recommended default, and a status.

Statuses: `open`, `answered`, `obsolete`. Do not delete answered entries —
they are part of the design history.

---

## Q-003 — Auto-deploy target

**GDD reference:** [§21](gdd/21-technical-design-for-web-implementation.md), §26
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** Where should `main` auto-deploy to? Options: Vercel (matches
Next.js defaults), Cloudflare Pages, Netlify, GitHub Pages with a static
export, or self-hosted.

**Recommended default.** Vercel preview + production, free tier, configured
via a `vercel.json` and a GitHub Action triggered on push to `main`. Easy to
swap later because the app stays static-exportable.

**Resolution.** Vercel Hobby (free tier, region `iad1`) with GitHub Actions
gating production deploys. Two-job workflow: `verify` runs lint + typecheck
+ Vitest + Playwright on every PR and on push to `main`; `deploy` runs only
on push to `main` after `verify` is green, using `vercel build --prod` +
`vercel deploy --prebuilt --prod` so the build runs in CI logs and the
artefact is what ships. `verify` and `deploy` use separate concurrency
groups: `verify` cancels stale runs, `deploy` does not, so a rapid second
push cannot abort an in-flight production deploy. The Vercel GitHub App
handles PR previews. Required secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`. Cloudflare Pages, Netlify, GitHub Pages, and
self-hosted were rejected (rationale in the closing reason of dot
`VibeGear2-research-choose-deploy-bcfb9148`). See the recovery slice
`feat/github-actions-ci-recovery` (re-applied work originally on
`feat/github-actions-ci`, dot `VibeGear2-implement-github-actions-1780fc58`).

**Blocking?** Yes for `F-003`. Resolved.

---

## Q-002 — Licence choice

**GDD reference:** §1 ("Code under a permissive open-source license. Assets
under original permissive asset licenses."), §26
**Status:** open
**Asked in loop:** 2026-04-26

**Question.** Which permissive licence for code (MIT vs Apache-2.0 vs BSD-2)
and which for assets (CC0 vs CC-BY-4.0 vs CC-BY-SA-4.0)?

**Recommended default.** MIT for code (broadest compatibility, simplest),
CC-BY-4.0 for original assets (credit required, remix allowed). Add `LICENSE`
and `ASSETS-LICENSE` files at repo root.

**Blocking?** No for early implementation, yes before any public release.

---

## Q-001 — Section 21 stack confirmation

**GDD reference:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** [`docs/gdd/01-title-and-high-concept.md`](gdd/01-title-and-high-concept.md) says: "Reuse VibeRacer patterns:
Next.js, React, TypeScript, custom math, Web Audio, local storage, schema
validation, and automated tests." Should §21 simply codify that exact stack,
or is anything intended to differ (e.g. SvelteKit, Vite, no React)?

**Recommended default.** Codify exactly the stated stack: Next.js (App
Router), React 18, TypeScript strict, Vitest for unit, Playwright for e2e,
Zod for schema validation, Web Audio for sound, Canvas2D for the road
renderer.

**Resolution.** §21 already exists in the canonical Markdown tree and
specifies the recommended layers (App shell, Runtime core, Renderer, Audio,
Data, Persistence, Mod layer) along with the suggested module structure under
`src/game/`, `src/road/`, `src/render/`. The Phase 0 scaffold slice adopts
that structure verbatim with the recommended default stack: Next.js 15 (App
Router), React 18, TypeScript 5 strict, Zod 3, Vitest 2 for unit. Playwright,
GitHub Actions CI, and the auto-deploy target (Q-003) ship in their own
slices. See the matching `PROGRESS_LOG.md` entry.

**Blocking?** Yes for Phase 0 project skeleton (`F-002`). Resolved.
