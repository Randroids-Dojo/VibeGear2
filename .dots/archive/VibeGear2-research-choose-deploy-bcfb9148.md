---
title: "research: choose deploy target for Q-003 and design CI workflow"
status: closed
priority: 0
issue-type: task
created-at: "\"\\\"2026-04-26T00:55:59.159737-05:00\\\"\""
closed-at: "2026-04-26T01:09:58.672040-05:00"
close-reason: Chose Vercel Hobby + GitHub Actions CI-gated deploy. Speced .github/workflows/ci.yml (verify + deploy jobs, deploy via vercel CLI with --prebuilt --prod, secrets VERCEL_TOKEN/ORG_ID/PROJECT_ID), minimal vercel.json, and refined the implement dot with prerequisites + Affected Files. Rejected Cloudflare Pages, Netlify, GitHub Pages with reasons in the dot.
---

Resolve Q-003 in OPEN_QUESTIONS.md (Vercel vs Cloudflare Pages vs Netlify vs GitHub Pages). Spec the GitHub Actions workflow shape for build + lint + type-check + unit + e2e + deploy. Output: implement: dot for the deploy pipeline (F-003) and any CI dots needed.

## Findings

### Decision: Vercel + GitHub Actions (CI-gated deploy)

**Deploy target:** Vercel Hobby (free) tier. **CI gate:** GitHub Actions runs lint, typecheck, unit, and e2e on every PR and on push to `main`. **Deploy trigger:** GitHub Actions deploys to Vercel via the `vercel` CLI only after the CI job is green on `main`. The Vercel GitHub App is **not** used for auto-deploys (we use the CLI from Actions instead) so that deploys are strictly gated on the same CI run that exercises the smoke tests.

### Why Vercel

1. Built and maintained by the same team as Next.js. Zero-config App Router, React Server Components, image optimisation, route handlers, and ISR. Required by §21's "optional leaderboard / ghost backend" plans which will use route handlers in Phase 5.
2. Hobby tier is free and well over our envelope: 100 GB bandwidth/month, 100 prod deploys/day, unlimited preview deploys, 100 build hours/month. A static-rendered title screen plus a couple of MB of assets will not approach those limits.
3. `typedRoutes: true` (already enabled in `next.config.mjs:11`) works natively on Vercel without configuration. Under a static export it works only while no dynamic route handlers exist; on Vercel it keeps working when we add them.
4. PR previews are first-class. Every PR gets a unique URL, satisfying `WORKING_AGREEMENT.md` §6 manual-verification requirement.
5. Easy escape hatch. The app remains static-exportable (`output: "export"`) until we add route handlers, so a migration to Cloudflare Pages or GitHub Pages remains a configuration change, not a rewrite.

### Why not the alternatives

- **Cloudflare Pages.** Generous free tier (unlimited bandwidth) but App Router support requires `@cloudflare/next-on-pages`, which adds an extra build step and has shifting compatibility (RSC streaming, middleware, edge runtime quirks). Maintenance cost not justified for a hobby project.
- **Netlify.** Native Next.js plugin works, but historically lags Vercel by a release cycle on App Router features. No upside over Vercel for this stack.
- **GitHub Pages + static export.** Forces `output: "export"` from day one, which removes the ability to add route handlers without a platform migration. §21 calls for an optional leaderboard / ghost backend in Phase 5, which would require migrating off GitHub Pages. Reject.
- **Self-hosted.** Out of scope for an open-source hobby project. SSL renewal, monitoring, uptime, and CDN setup overhead are not justified.

### CI workflow design (`.github/workflows/ci.yml`)

Single workflow file, two jobs (`verify` and `deploy`). Triggers: `pull_request` (any branch into `main`) and `push` (only `main`).

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    name: Lint, typecheck, unit, e2e
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Build for e2e
        run: npm run build
      - name: Run Playwright e2e
        run: npm run test:e2e
      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7
  deploy:
    name: Deploy to Vercel (production)
    needs: verify
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment:
      name: production
      url: ${{ steps.vercel-deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Pull Vercel env
        run: npx vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      - name: Build (Vercel)
        run: npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy
        id: vercel-deploy
        run: |
          url=$(npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }})
          echo "url=$url" >> "$GITHUB_OUTPUT"
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

Why this shape:
- `concurrency` cancels stale runs on rapid pushes.
- `npm ci` not `npm install` so lockfile is authoritative.
- `npx playwright install --with-deps chromium` installs only chromium (matches `playwright.config.ts` projects array). Reduces install time vs all browsers.
- e2e runs against the production build, not dev server, to match deployed behaviour.
- Playwright HTML report uploaded only on failure (artefact retention 7 days, fits free tier).
- `deploy` job needs `verify` and only runs on push to `main`. Branch protection on `main` will require `verify` green; combined with squash-merge, this enforces "no broken main".
- Vercel CLI deploy uses `--prebuilt` so the build runs in GH Actions (visible in CI logs), not in Vercel's opaque builder. This makes build failures debuggable in the same UI as CI failures.

### Required secrets (set via GitHub repo Settings -> Secrets and variables -> Actions)

- `VERCEL_TOKEN` — personal token from https://vercel.com/account/tokens, scoped to the project's team.
- `VERCEL_ORG_ID` — from `.vercel/project.json` after running `vercel link` once locally.
- `VERCEL_PROJECT_ID` — same source.

The `vercel link` step is a one-time human action. Document this in the implement dot.

### `vercel.json`

Minimal, since Next.js auto-detection covers most cases:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm ci",
  "regions": ["iad1"]
}
```

`iad1` (Washington DC) is the free-tier default; we can revisit when latency matters.

### PR previews

Two options, deferred for now:
1. **Cheap option** (recommended for v0.1): rely on the Vercel GitHub App for preview deploys on PR branches. The App reads from main. Running both the GH Actions deploy and the App deploy is fine — they target different envs (preview vs prod) and different triggers (PR vs main).
2. **Full control option**: add a `preview` job in `ci.yml` that runs `vercel deploy` (no `--prod`) on every PR. Comments the URL on the PR. Skip until v0.1 ships.

For v0.1 ship, install the Vercel GitHub App **without** auto-prod (toggle: "Production deployments from the Git provider": OFF). Previews stay on, prod stays gated by GH Actions.

### Open follow-ups created

- Implement dot `VibeGear2-implement-github-actions-1780fc58` already exists and now has a clear spec; refine its Affected Files and Verify sections to match the workflow shape above.
- New implement dot for the human-only `vercel link` + secret-setting prerequisite; capture in the implement dot's prerequisites section.

### Documentation updates needed by the implement slice

1. `docs/OPEN_QUESTIONS.md` Q-003 status -> `answered` with the resolution above.
2. `docs/FOLLOWUPS.md` F-003 status -> `in-progress` while the implement slice is open, then `done`.
3. `docs/gdd/21-technical-design-for-web-implementation.md` add a "Deploy target" subsection naming Vercel.
4. `README.md` add the deployed URL once the first deploy lands.
