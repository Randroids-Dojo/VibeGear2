---
title: "implement: CI bundle-size budget + Lighthouse perf gate + axe a11y gate per §27 §21 quality gates"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:09:19.826638-05:00\\\"\""
closed-at: "2026-04-29T23:39:05.974189-05:00"
close-reason: "Merged PR #116, main CI green, production deploy verified, and production smoke passed at 4a53cd8."
blocks:
  - VibeGear2-implement-cross-browser-7cf643ce
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Add three enforceable CI quality gates:

1. **Bundle-size budget.** A per-route maximum first-load JS size enforced by
   a script that parses Next.js's build output and fails CI when any tracked
   route exceeds its configured ceiling. Initial budget mirrors the current
   shipped sizes plus a 10% headroom; tightened in later slices once content
   lands.
2. **Lighthouse performance gate.** Single-page Lighthouse run against the
   built `next start` server during CI; fails when the perf score drops
   below 80 or the a11y score drops below 90 (a11y threshold matches what
   `implement-cross-browser-7cf643ce` already lists as a verify item).
3. **axe a11y gate.** axe-core run against the title screen and the dev
   road page during CI; fails on any "serious" or "critical" violation.

This is the missing automation backing the cross-browser slice's manual
checklist. The cross-browser slice covers browser-coverage and manual
exercises; this slice ships the green-or-red gates that prevent regressions
between manual passes.

## Context

GDD §21 "Performance constraints" calls for "Cap draw distance adaptively",
"Allow sprite-density reduction", etc., all run-time strategies; it does not
name a build-time gate. GDD §27 "risks and mitigations" names performance
regression as a risk; the standard mitigation in a Next.js project is a
bundle budget + a Lighthouse run gated in CI. This slice ships those.

The slice depends on the F-003 deploy slice (which lands the GitHub Actions
workflow) for a workflow file to extend; if F-003 is not yet shipped when
this slice is picked up, the slice creates the workflow file with a
`build-and-test` job that runs `npm run verify` and adds the three gates as
additional steps.

The Lighthouse gate runs against `next start` (not the deployed URL) so it
is reproducible and free of network noise; the cross-browser slice also runs
Lighthouse against the deployed URL as a separate manual smoke.

## Affected Files

- `scripts/check-bundle-budget.ts` (new): reads `.next/build-manifest.json`
  and `.next/app-build-manifest.json`, computes the gzipped first-load JS
  per route, compares against a JSON budget file, exits non-zero on
  overage. Uses Node's `zlib.gzipSync` against the actual chunk bytes;
  no external dep.
- `scripts/budgets/route-budget.json` (new): `{ "/": 95000, "/dev/road":
  150000, "/garage": 120000 }` (bytes; tune to current shipped values plus
  10%). The cross-browser slice updates these once content lands and the
  numbers are stable.
- `scripts/lighthouse-ci.ts` (new): boots `next start` on a free port, runs
  Lighthouse via the official `lighthouse` CLI (devDependency), parses the
  JSON report, fails when `categories.performance.score < 0.80` or
  `categories.accessibility.score < 0.90`. Caps run time at 90 seconds.
- `scripts/axe-smoke.ts` (new): launches Playwright Chromium against
  `http://localhost:3000/` and `/dev/road`; runs `@axe-core/playwright`;
  fails on any `serious` or `critical` violation. Uses the existing
  Playwright install once `implement-add-playwright` (already shipped) is
  present.
- `package.json` (modify):
  - devDependencies: `lighthouse@^12`, `@axe-core/playwright@^4`,
    `wait-on@^8` (for the Lighthouse boot wait).
  - scripts:
    - `bundle:budget`: `npm run build && tsx scripts/check-bundle-budget.ts`.
    - `lighthouse:ci`: `npm run build && tsx scripts/lighthouse-ci.ts`.
    - `axe:ci`: `npm run build && tsx scripts/axe-smoke.ts`.
    - `verify:full`: composite of `verify` + the three above.
- `.github/workflows/quality-gates.yml` (new, or extend existing CI yaml
  once F-003 lands): a `quality-gates` job that runs the three scripts
  after the build step. Job is required for PR merge.
- `docs/gdd/27-risks-and-mitigations.md` (modify): add a row "Performance
  regression: CI bundle budget + Lighthouse gate".
- `docs/CONTRIBUTING.md` (modify if it has shipped via
  `implement-contributing-md-0df67cce`): add a "Quality gates" subsection
  pointing at the three scripts.
- `scripts/budgets/README.md` (new): one paragraph explaining the budget
  format, when to update it (only as part of an intentional regression
  with a PROGRESS_LOG entry justifying it), and the headroom convention.

## Edge Cases

- A new route added without a budget entry: the script defaults to the
  global cap (200 KB gzipped) and warns. Test asserts.
- A budget entry for a route that no longer exists: the script warns and
  skips; does not fail. Document so refactors do not break CI on the
  bisected commit.
- Lighthouse boot timeout: hard cap at 90 seconds; on timeout the script
  fails with a clear message naming the port and the build output to
  inspect.
- axe-core flakiness on dynamic content: the smoke runs after a 500 ms
  settle and a `waitForLoadState("networkidle")`; documented in the
  script header.
- CI runners without enough memory for headless Chromium: budget run is
  the cheap one (no browser); Lighthouse and axe both use the same
  Playwright Chromium and depend on the runner having `apt install`-class
  permissions. Document the runner image expectation in the workflow yaml.
- Source maps from `implement-build-ver-c26ddc1f` are NOT counted in the
  bundle budget (they are not shipped to clients by default). Test
  asserts.

## Verify

- [ ] `npm run bundle:budget` is green on the current `main`.
- [ ] Manually adding a 200 KB string literal to the title page makes
      `bundle:budget` red (validates the gate works).
- [ ] `npm run lighthouse:ci` is green on the current `main` (perf >= 80,
      a11y >= 90).
- [ ] `npm run axe:ci` is green on the current `main`.
- [ ] CI workflow file `.github/workflows/quality-gates.yml` exists and the
      `quality-gates` job is required on PRs.
- [ ] Budget JSON has an entry per current public route.
- [ ] No em-dashes or en-dashes in added files.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/21-technical-design-for-web-implementation.md` "Performance
  constraints".
- `docs/gdd/27-risks-and-mitigations.md`.
- `.dots/VibeGear2-implement-cross-browser-7cf643ce.md` (manual a11y / perf
  smoke; this slice automates the gates).
- `.dots/VibeGear2-implement-build-ver-c26ddc1f.md` (sourcemaps excluded
  from budget).
- `.dots/VibeGear2-implement-tagged-release-b3d30084.md` (release smoke
  depends on these gates).
