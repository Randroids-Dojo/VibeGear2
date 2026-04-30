# npm Scripts

This page is the quick reference for every script in `package.json`.
Run commands from the repository root.

| Script | Purpose | When to run | Failure usually means |
| --- | --- | --- | --- |
| `dev` | Starts the Next.js dev server. | Local feature work. | Port conflict, invalid environment, or compile error. |
| `build` | Creates the production Next.js build and then runs `postbuild`. | Before production-like smoke tests. | Type, route, asset, or Next.js build failure. |
| `postbuild` | Scrubs source maps for workspace-local paths after `next build`. | Automatically after `build`. | Source map layout changed or generated files are missing. |
| `start` | Serves the built app on port 3000. | Playwright or production build smoke tests. | Run `npm run build` first, or free the port. |
| `lint` | Runs `next lint`. | Before pushing any PR. | ESLint found a warning or error that CI will reject. |
| `typecheck` | Runs `tsc --noEmit`. | Before pushing TypeScript changes. | Type contracts drifted or generated types are stale. |
| `test` | Runs the Vitest unit suite once. | Before pushing logic, data, or docs-lint changes. | A unit, content-lint, route, or pure renderer invariant broke. |
| `test:watch` | Runs Vitest in watch mode. | While iterating locally. | Same as `test`, but reruns after edits. |
| `test:e2e` | Runs Playwright against a production build. | Before PRs that touch routes, UI, race flow, or persistence. | Browser flow, routing, build, or selector regression. |
| `test:e2e:cross-browser` | Runs the compatibility smoke on Chromium, Firefox, and WebKit. | Before browser hardening or release PRs. | A core route, canvas boot, keyboard path, or browser API differs across engines. |
| `test:e2e:ui` | Opens the Playwright UI runner. | Debugging a failing e2e test locally. | Playwright cannot launch or the app is not built correctly. |
| `quality:bundle` | Checks route and total static gzip budgets from the Next app build manifest. | After `npm run build`, before release or performance PRs. | A route or total static asset budget regressed. |
| `quality:lighthouse` | Starts the production build and runs Lighthouse on core routes. | After `npm run build`, before release or performance PRs. | Performance, accessibility, or best-practices score fell below the release gate. |
| `quality:gates` | Runs bundle and Lighthouse quality gates. | In CI after the production build. | Bundle budget or Lighthouse release gate failed. |
| `bench:render` | Runs the render benchmark suite. | Renderer, sprite, parallax, road, HUD, or VFX PRs. | Perf harness failure or a large frame-time regression. |
| `art:generate` | Regenerates placeholder art assets. | Only when intentionally refreshing generated art. | Art generator or manifest contract changed. |
| `art:check` | Validates art manifest coverage. | Before PRs that touch art. | Missing manifest entry, bad path, or invalid art metadata. |
| `audio:generate` | Regenerates placeholder audio assets. | Only when intentionally refreshing generated audio. | Audio generator or manifest contract changed. |
| `audio:check` | Validates audio manifest coverage. | Before PRs that touch audio. | Missing manifest entry, bad path, or invalid audio metadata. |
| `content-lint` | Runs repository content and docs guardrails. | Before docs, GDD, data, mod, or progress-log PRs. | Legal safety, GDD ledger, progress-log, or content schema issue. |
| `docs:check` | Checks this script catalogue and shared workflow anchors. | Before docs or contributor workflow PRs. | `docs/SCRIPTS.md`, `AGENTS.md`, or `docs/CONTRIBUTING.md` drifted. |
| `verify` | Runs docs check, lint, typecheck, unit, content, art, and audio checks. | Before every commit and PR. | Any local CI gate failed. |
| `verify:full` | Runs `verify` and then Playwright e2e. | Before UI, route, persistence, or release PRs. | Baseline checks or browser smoke failed. |

## Common Runs

| Situation | Command |
| --- | --- |
| First local confidence pass | `npm run verify` |
| Browser or route change | `npm run verify:full` |
| Cross-browser hardening | `npm run test:e2e:cross-browser` |
| Release quality gates | `npm run build && npm run quality:gates` |
| Renderer change | `npm run verify && npm run bench:render` |
| Docs-only change | `npm run docs:check && npm run content-lint` |
| Art change | `npm run art:check` |
| Audio change | `npm run audio:check` |
