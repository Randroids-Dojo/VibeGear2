# Open Questions

Questions the agent has paused on, awaiting dev input. Newest at the top.
Each entry has an id (`Q-NNN`), a GDD reference, the question, options
considered, the agent's recommended default, and a status.

Statuses: `open`, `answered`, `obsolete`. Do not delete answered entries —
they are part of the design history.

---

## Q-003 — Auto-deploy target

**GDD reference:** §21 (not yet authored), §26
**Status:** open
**Asked in loop:** 2026-04-26

**Question.** Where should `main` auto-deploy to? Options: Vercel (matches
Next.js defaults), Cloudflare Pages, Netlify, GitHub Pages with a static
export, or self-hosted.

**Recommended default.** Vercel preview + production, free tier, configured
via a `vercel.json` and a GitHub Action triggered on push to `main`. Easy to
swap later because the app stays static-exportable.

**Blocking?** Yes for `F-003`. Other slices can proceed without it.

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

**GDD reference:** §21 (file not yet authored)
**Status:** open
**Asked in loop:** 2026-04-26

**Question.** `01-title-and-high-concept.md` says: "Reuse VibeRacer patterns:
Next.js, React, TypeScript, custom math, Web Audio, local storage, schema
validation, and automated tests." Should §21 simply codify that exact stack,
or is anything intended to differ (e.g. SvelteKit, Vite, no React)?

**Recommended default.** Codify exactly the stated stack: Next.js (App
Router), React 18, TypeScript strict, Vitest for unit, Playwright for e2e,
Zod for schema validation, Web Audio for sound, Canvas2D for the road
renderer.

**Blocking?** Yes for Phase 0 project skeleton (`F-002`).
