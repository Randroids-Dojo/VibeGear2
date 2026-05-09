---
title: "implement: GitHub Actions CI + auto-deploy to Vercel (F-003)"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-26T00:56:14.849570-05:00\\\"\""
closed-at: "2026-04-26T01:13:49.684295-05:00"
close-reason: Landed .github/workflows/ci.yml (verify + deploy jobs), vercel.json, .vercel/ + .claude/ in gitignore. Updated §21 with Deploy target subsection, README with Deploy + setup steps, Q-003 marked answered, F-003 in-progress until first green prod deploy. verify job is the meaningful CI gate; deploy will fail until human prerequisites (vercel link + 3 repo secrets) complete, by design. Local lint/typecheck/test/build all green.
blocks:
  - VibeGear2-implement-add-playwright-c2ccf4f9
---

## Description

Add a single `.github/workflows/ci.yml` that runs lint, typecheck, unit tests, and Playwright e2e on every PR and on push to `main`. On push to `main`, after the verify job is green, deploy to Vercel using the Vercel CLI with `--prebuilt --prod`. Closes F-003 and answers Q-003 (Vercel chosen).

See the predecessor research dot `VibeGear2-research-choose-deploy-bcfb9148` for the full workflow YAML, decision rationale, and rejected alternatives.

## Context

`docs/IMPLEMENTATION_PLAN.md` §1 goal 2 ("keep main shippable at all times") and `docs/WORKING_AGREEMENT.md` §5 (broken deploys on main are P0). F-003 is `blocks-release` per `docs/FOLLOWUPS.md`.

Q-003 is resolved: deploy target is **Vercel Hobby (free)**. CI is GitHub Actions. Deploy is gated by the verify job on push to `main`.

## Prerequisites (one-time human actions, not in this PR)

These cannot be done by an agent and block the deploy job:

1. Create a Vercel account if needed; create a new project from the GitHub repo (do NOT enable "Production deployments from Git provider" — only enable previews).
2. From the project root locally: `npx vercel link` to generate `.vercel/project.json`. Read `orgId` and `projectId` from that file. Add `.vercel/` to `.gitignore`.
3. Generate a token at https://vercel.com/account/tokens scoped to the project's team.
4. Add three GitHub repo secrets (Settings -> Secrets and variables -> Actions):
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
5. Configure branch protection on `main`: require the `verify` job status check to pass before merge.

The implement slice should land the workflow file even before steps 1-5 are done; the `deploy` job will fail on first push to `main` until the secrets exist, and that failure is visible and actionable. Document the prerequisites in the PR body so the dev can complete them in parallel.

## Affected Files

- `.github/workflows/ci.yml` (new) — single workflow with `verify` and `deploy` jobs per the research dot's YAML spec.
- `vercel.json` (new) — minimal, declares `framework: nextjs`, build command, install command, region `iad1`.
- `.gitignore` (modify) — add `.vercel/` so `vercel link` artefacts are local-only.
- `README.md` (modify) — add a "Deploy" section with the production URL placeholder and a one-line "PRs get a Vercel preview URL" note.
- `docs/OPEN_QUESTIONS.md` — mark Q-003 `answered` with resolution: "Vercel + GitHub Actions, see PROGRESS_LOG.md entry for this slice".
- `docs/FOLLOWUPS.md` — mark F-003 `done` once first deploy lands successfully.
- `docs/gdd/21-technical-design-for-web-implementation.md` — append a short "Deploy target" subsection naming Vercel and pointing at `.github/workflows/ci.yml`.
- `docs/PROGRESS_LOG.md` — new entry per the §6 template.

## Verify

- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` all pass locally.
- [ ] Pushing the branch opens a PR; the `verify` job runs and goes green.
- [ ] No em-dashes in any added file (`grep -rn $'—' .github vercel.json README.md docs/`).
- [ ] After the prerequisites are completed by the dev and the PR is merged to `main`, the `deploy` job runs and succeeds.
- [ ] The deployed URL serves the title screen (`<h1>VibeGear2</h1>` visible).
- [ ] PROGRESS_LOG.md entry added.
- [ ] FOLLOWUPS.md marks F-003 `done`. OPEN_QUESTIONS.md marks Q-003 `answered`.
