# VibeGear2

Open sourced and vibed spiritual successor to Top Gear 2.

This repo contains the design, source, and project notes for VibeGear2.

## Stack

Next.js 15 (App Router), React 18, TypeScript 5 (strict), Zod 3, Vitest 2.
See [`docs/gdd/21-technical-design-for-web-implementation.md`](docs/gdd/21-technical-design-for-web-implementation.md) for the
full architecture and module layout.

## Local development

```bash
npm install
npm run dev        # start the Next.js dev server on http://localhost:3000
npm run verify     # lint + type-check + unit tests
npm run build      # production build
```

## Layout

- `src/app/` Next.js App Router pages, including the title screen.
- `src/game/` runtime core: race state, simulation, AI, economy.
- `src/road/` track data and pseudo-3D segment projection.
- `src/render/` Canvas2D renderer, sprite atlas, HUD overlay.
- `docs/` GDD, implementation plan, working agreement, and per-loop logs.

## Deploy

`main` deploys to Vercel Hobby (region `iad1`) via GitHub Actions. Every
push to `main` runs the `verify` job (lint, type-check, Vitest unit, Playwright
e2e against a production build); on green, the `deploy` job runs `vercel build
--prod` + `vercel deploy --prebuilt --prod`. Pull requests get Vercel preview
URLs through the Vercel GitHub App. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
and [`docs/gdd/21-technical-design-for-web-implementation.md`](docs/gdd/21-technical-design-for-web-implementation.md)
"Deploy target". Production URL added once the first deploy lands.

### One-time setup (human only)

1. Create the Vercel project from this GitHub repo. Disable "Production
   deployments from the Git provider" so production stays gated by CI.
2. Run `npx vercel link` locally to generate `.vercel/project.json`. Read
   `orgId` and `projectId` from that file. `.vercel/` is gitignored.
3. Create a token at https://vercel.com/account/tokens scoped to the project
   team.
4. Add three GitHub repo secrets under Settings to Secrets and variables to
   Actions: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
5. Configure branch protection on `main` to require the `verify` status
   check.

Until steps 1-4 are complete, the `deploy` job will fail on push to `main`;
the `verify` job runs unconditionally and is the meaningful CI gate.

## Reading order for new contributors

1. [`AGENTS.md`](AGENTS.md) for the rules every agentic and human contributor follows.
2. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for what to build.
3. [`docs/WORKING_AGREEMENT.md`](docs/WORKING_AGREEMENT.md) for how to behave while building it.
4. [`GDD.md`](GDD.md) and [`docs/gdd/`](docs/gdd/) for the design itself.
5. [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md), [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md), and [`docs/FOLLOWUPS.md`](docs/FOLLOWUPS.md) for current state.
