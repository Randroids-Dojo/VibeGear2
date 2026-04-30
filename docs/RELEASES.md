# Release Branches

This document defines the stable release branch contract required by
[`docs/gdd/25-development-roadmap.md`](gdd/25-development-roadmap.md) for v1.0
readiness.

## Current Stable Branch Target

| Line | Branch | Tag | Branch base | Status | Purpose |
| --- | --- | --- | --- | --- | --- |
| Content-complete World Tour | `release/v0.2` | `v0.2.0` | Post-PR #140 merge commit | Planned | Stable branch for the 32-track World Tour release candidate. |

The branch is created after the release-refresh PR merges and the tag passes
production smoke. The branch starts at the first `main` commit after `v0.2.0`
that adds the release branch CI and support docs, so release-branch PRs have
pre-merge checks available.

## Branch Rules

- `main` remains the only production deploy branch.
- `release/*` branches receive CI verification but do not deploy to
  production.
- Backports to a release branch require their own PR into that branch.
- A backport PR must link the original `main` PR, the affected tag, and the
  production issue or followup that justifies the patch.
- New feature work does not land on release branches. Use `main`.
- A new stable branch is created only after a tagged release has passed main
  CI, CodeQL, Vercel production verification, and external production smoke.

## Creating a Stable Branch

After a release PR is merged and the tag is pushed:

```bash
git fetch origin --tags
git checkout main
git pull --ff-only origin main
git rev-parse --short HEAD
git rev-parse --short v0.2.0
git branch release/v0.2 main
git push origin release/v0.2
```

The branch push should trigger CI. Watch it to completion. A failing
release-branch CI run is a release-support blocker and must be fixed before
the slice closes.

## Smoke Checklist

For every new stable branch, record the following in `docs/PROGRESS_LOG.md`:

- release tag
- release branch name
- commit SHA
- main CI result
- CodeQL result
- Vercel production verifier result
- external production `/api/version` result
- route smoke result
- release-branch CI result, if a workflow ran

## Backport Checklist

1. Start from the release branch: `git checkout -b fix/<slice> origin/release/v0.2`.
2. Apply the smallest patch needed for the released line.
3. Run `npm run verify` and any targeted e2e or production smoke needed.
4. Open the PR against the release branch, not `main`.
5. After merge, tag a patch release if the fix changes shipped behavior.
