# VibeGear2

Open sourced and vibed spiritual successor to Top Gear 2.

This repo contains the design, source, and project notes for VibeGear2.

## Stack

Next.js 15 (App Router), React 18, TypeScript 5 (strict), Zod 3, Vitest 2,
Playwright 1.48. See [`docs/gdd/21-technical-design-for-web-implementation.md`](docs/gdd/21-technical-design-for-web-implementation.md)
for the full architecture and module layout.

## Local development

```bash
npm install
npx playwright install chromium    # one-time browser install for e2e
npm run dev          # start the Next.js dev server on http://localhost:3000
npm run verify       # lint + type-check + unit tests
npm run test:e2e     # Playwright smoke tests against a production build
npm run verify:full  # verify + test:e2e
npm run build        # production build
```

## Layout

- `src/app/` Next.js App Router pages, including the title screen.
- `src/game/` runtime core: race state, simulation, AI, economy.
- `src/road/` track data and pseudo-3D segment projection.
- `src/render/` Canvas2D renderer, sprite atlas, HUD overlay.
- `docs/` GDD, implementation plan, working agreement, and per-loop logs.

## Licensing

VibeGear2 uses separate licenses for code, original assets, and structured
game data:

- Source code is licensed under MIT. See [`LICENSE`](LICENSE).
- Original art, sprites, sound effects, music, and asset manifests default to
  CC BY 4.0. See [`ASSETS-LICENSE`](ASSETS-LICENSE).
- Track, championship, balancing, and community mod data default to
  CC BY-SA 4.0. See [`DATA-LICENSE`](DATA-LICENSE).

The asymmetry is intentional: code stays permissive, original media preserves
attribution, and community track or data remixes stay share-alike.

## Deploy

`main` deploys to Vercel Hobby (region `iad1`) via GitHub Actions. Every push
to `main` runs the `verify` job (lint, type-check, Vitest unit, Playwright e2e
against a production build); on green, the `deploy` job runs `vercel build
--prod` + `vercel deploy --prebuilt --prod`. Pull requests get Vercel preview
URLs through the Vercel GitHub App. PR previews and the production deploy gate
are documented in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and
[`docs/gdd/21-technical-design-for-web-implementation.md`](docs/gdd/21-technical-design-for-web-implementation.md)
"Deploy target". The render perf bench can be triggered manually via the
"Run workflow" button on the CI workflow with `run_bench=true`; it is
informational and never gates a merge or deploy.

### One-time setup (human only)

1. Create the Vercel project from this GitHub repo. Disable "Production
   deployments from the Git provider" so production stays gated by CI.
2. Run `npx vercel link` locally to generate `.vercel/project.json`. Read
   `orgId` and `projectId` from that file. `.vercel/` is gitignored.
3. Create a token at https://vercel.com/account/tokens scoped to the project
   team.
4. Add three GitHub repo secrets under Settings, Secrets and variables, then
   Actions: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
5. Configure branch protection on `main` to require the `verify` status
   check.

Until steps 1 to 4 are complete, the `deploy` job will fail on push to `main`;
the `verify` job runs unconditionally and is the meaningful CI gate.

## Reading order for new contributors

1. [`AGENTS.md`](AGENTS.md) for the rules every agentic and human contributor follows.
2. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for what to build.
3. [`docs/WORKING_AGREEMENT.md`](docs/WORKING_AGREEMENT.md) for how to behave while building it.
4. [`GDD.md`](GDD.md) and [`docs/gdd/`](docs/gdd/) for the design itself.
5. [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md), [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md), and [`docs/FOLLOWUPS.md`](docs/FOLLOWUPS.md) for current state.

Legal safety: see [`docs/LEGAL_SAFETY.md`](docs/LEGAL_SAFETY.md) for the
canonical safe and unsafe content patterns, the PR checklist, and the
`legal-review` escalation path. Read this before contributing any art,
audio, track data, or non-trivial code that resembles existing
copyrighted material.

Contributing: see [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for branch,
PR, verification, originality, licensing, and review expectations.
