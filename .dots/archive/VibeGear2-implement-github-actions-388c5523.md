---
title: "implement: GitHub Actions CI + Vercel auto-deploy (F-003) (RE-OPENED)"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-26T02:52:47.575541-05:00\\\"\""
closed-at: "2026-04-26T04:01:44.667445-05:00"
close-reason: "verified: .github/workflows/ci.yml + vercel.json + .gitignore .vercel/+.claude/ + README Deploy section + GDD §21 Deploy target + Q-003 answered + F-003 in-progress + PROGRESS_LOG entry. Lint, typecheck, test (429), build, test:e2e (4) all green. Iteration-17 stress test #5 applied: split concurrency groups so deploy is uncancellable. Bench wired as workflow_dispatch-only with continue-on-error: true so it never gates. F-003 advances to done after first prod deploy."
blocks:
  - VibeGear2-implement-add-playwright-64eb2a44
---

Re-opened: a prior dot (VibeGear2-implement-github-actions-1780fc58) was closed in iteration 16 with a close-reason claiming .github/workflows/ci.yml + vercel.json + .gitignore .vercel/ + README Deploy section + Q-003 answered + F-003 in-progress all landed. None of those files exist in the repo (.github/ absent, vercel.json absent, .gitignore has no .vercel/ entry), Q-003 in docs/OPEN_QUESTIONS.md is still 'open', and F-003 in docs/FOLLOWUPS.md is still 'blocks-release / open'.

Land the workflow file plus the Vercel scaffold per the unchanged research dot VibeGear2-research-choose-deploy-bcfb9148 (which is closed and has the full YAML + decision rationale).

## Context
docs/IMPLEMENTATION_PLAN.md §1 goal 2 ('keep main shippable at all times') and docs/WORKING_AGREEMENT.md §5 (broken deploys on main are P0). F-003 is blocks-release. Q-003 needs flipping to answered.

Depends on (after): the Playwright harness re-open dot (VibeGear2-implement-add-playwright-64eb2a44 in this iteration). The verify job in the workflow runs npx playwright install + npm run test:e2e, so the harness must exist first or the verify job will fail.

## Prerequisites (one-time human actions, not in this PR)
1. Create Vercel project from the GitHub repo. Toggle off 'Production deployments from Git provider'; previews stay on.
2. Locally: npx vercel link to generate .vercel/project.json. Read orgId + projectId.
3. Generate token at https://vercel.com/account/tokens scoped to the project's team.
4. Add three GitHub repo secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.
5. Configure branch protection on main: require the 'verify' job status check before merge.

The implement slice should land the workflow file even before steps 1-5 are done. The deploy job will fail on first push to main until the secrets exist; that failure is visible and actionable. Document the prerequisites in the PR body.

## Affected files
- .github/workflows/ci.yml (new): single workflow with verify and deploy jobs per the YAML in the research dot. Triggers: pull_request -> main, push -> main. Concurrency group ci-\${{ github.ref }} cancel-in-progress true. verify runs npm ci + lint + typecheck + test + playwright install --with-deps chromium + build + test:e2e + upload report artefact on failure. deploy needs verify, runs only on push to main, uses npx vercel pull/build/deploy --prebuilt --prod with the three secrets.
- vercel.json (new): { framework: nextjs, buildCommand: 'next build', installCommand: 'npm ci', regions: ['iad1'] } with the openapi.vercel.sh schema.
- .gitignore: append '.vercel/' so vercel link artefacts are local-only.
- README.md: add a Deploy section with the production URL placeholder and a one-line 'PRs get a Vercel preview URL' note.
- docs/OPEN_QUESTIONS.md: flip Q-003 from open to answered with a Resolution block citing this slice's PR.
- docs/FOLLOWUPS.md: F-003 to in-progress while the slice is open, then done once first deploy succeeds.
- docs/gdd/21-technical-design-for-web-implementation.md: append a short 'Deploy target' subsection naming Vercel and pointing at .github/workflows/ci.yml.
- docs/PROGRESS_LOG.md: standard slice entry per §6 of IMPLEMENTATION_PLAN.md.

## Verify
- npm run lint, typecheck, test, test:e2e all pass locally
- Pushing the branch opens a PR; the verify job runs and goes green (it is the meaningful CI gate)
- No em-dashes or en-dashes in any added file: grep -rn $'\u2013\|\u2014' .github vercel.json README.md docs/ returns nothing
- After the dev completes prerequisites + the PR merges to main, the deploy job runs and succeeds
- The deployed URL serves the title screen
- PROGRESS_LOG.md entry added; FOLLOWUPS.md F-003 -> done; OPEN_QUESTIONS.md Q-003 -> answered

## Why this re-open
Same iteration-16 retro pattern as the Playwright re-open: a close-reason that listed shipped files without the files existing. When closing a dot, the implementer must run a 'ls + git status' on the listed Affected Files before composing the close-reason. The iteration-17 spec-stress block on this dot (below) calls that out as a reviewer checklist.

## Recovery path (iteration 17 finding)
The work for the prior dot does exist on the local branch `feat/github-actions-ci` (commit 934f5b6 'ci: add GitHub Actions verify + Vercel auto-deploy (F-003)', branched from 4dbfc15 'feat(data): add Zod schemas...'). The branch was never merged to main and the working tree on every other feature branch (including this iteration's `feat/track-compiler-golden`) does not have the artefacts.

Options for the implementer:

1. **Merge / rebase forward (cheapest).** Cherry-pick or rebase commit 934f5b6 onto the current trunk (after the playwright re-open lands), resolve any conflicts, run `act` or push and watch the verify job, open a PR. Confirm the workflow's verify job passes; deploy will fail until the human prerequisites complete (that is by design).

2. **Re-implement (only if option 1 is broken).** Follow the Affected Files / Verify sections above and the YAML in the closed research dot VibeGear2-research-choose-deploy-bcfb9148. Apply the iteration-17 stress-test refinements (item 5 in particular: split concurrency groups so deploy is not cancellable mid-flight).

The implementer MUST add a PROGRESS_LOG.md entry that explicitly notes whether option 1 or option 2 was used, and links the prior closed dot id (VibeGear2-implement-github-actions-1780fc58).

## Reviewer checklist (post-merge)
Before closing this dot, confirm against `main` HEAD (not a feature branch):
- [ ] `ls .github/workflows/ci.yml vercel.json` both exist on main.
- [ ] `grep '.vercel/' .gitignore` returns a hit.
- [ ] First push to main triggers the workflow; the `verify` job goes green.
- [ ] docs/OPEN_QUESTIONS.md Q-003 status is `answered` with a Resolution block.
- [ ] docs/FOLLOWUPS.md F-003 status advanced to `in-progress` (only flip to `done` after the first prod deploy succeeds in a separate commit).
- [ ] docs/gdd/21-technical-design-for-web-implementation.md has a `Deploy target` subsection.
- [ ] If the merged commit (option 1) does not yet contain the iteration-17 stress-test refinements (concurrency split), open a follow-up dot to apply them rather than blocking this slice.

## Spec stress-test (iteration 17, researcher pass)
1. **Workflow runs against a node 20 toolchain.** package.json engines.node is '>=20.0.0'. The setup-node@v4 step pins '20'. Match. If a future bump pushes engines to >=22, the workflow needs the same bump.
2. **npm run start needs a port flag.** Next 15's 'next start' default port is 3000. If the playwright config (in the predecessor dot) standardises on 3100, the verify job needs 'npm run start -- --port 3100' OR the playwright webServer config must own the start command. Recommend the playwright webServer owns it (already in the harness dot's affected files), and the workflow simply runs npm run test:e2e.
3. **Playwright caches.** actions/setup-node cache: npm caches node_modules, but the @playwright/test browsers download (~150 MB chromium) is not in node_modules. Optional optimisation: actions/cache@v4 keyed on the Playwright version + ubuntu-latest. Defer to a polish slice; first cut runs --with-deps chromium each run.
4. **vercel CLI npx vs devDep.** The research dot uses npx vercel. Don't add 'vercel' to devDependencies. npx pulls the latest minor of the vercel CLI; deploys are reproducible enough since the build is npx vercel build --prod which captures the build at deploy time.
5. **Concurrency cancel-in-progress on push to main.** Cancelling a deploy mid-flight can leave Vercel in a confused state. Recommend keeping cancel-in-progress for verify on PRs only; for the deploy job, don't share the concurrency group. Easiest split: concurrency group should be 'ci-${{ github.ref }}' for verify and 'deploy-prod' (no cancel-in-progress) for deploy. Document this when writing the workflow.
6. **F-003 status flip.** F-003 today is 'blocks-release / open'. The dot's close should advance it to 'in-progress' (workflow exists, awaiting first green prod deploy) and a follow-up commit after the first prod deploy advances it to 'done'. Don't mark it 'done' from this slice alone.
