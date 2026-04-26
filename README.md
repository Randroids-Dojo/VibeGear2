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

## Reading order for new contributors

1. [`AGENTS.md`](AGENTS.md) for the rules every agentic and human contributor follows.
2. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for what to build.
3. [`docs/WORKING_AGREEMENT.md`](docs/WORKING_AGREEMENT.md) for how to behave while building it.
4. [`GDD.md`](GDD.md) and [`docs/gdd/`](docs/gdd/) for the design itself.
5. [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md), [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md), and [`docs/FOLLOWUPS.md`](docs/FOLLOWUPS.md) for current state.
