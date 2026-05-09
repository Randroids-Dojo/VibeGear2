---
title: "implement: tagged release v0.1 + smoke-tested deploy"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:59.939791-05:00\\\"\""
closed-at: "2026-04-30T00:20:06.524471-05:00"
close-reason: Released v0.1.0 from f8490b6, main CI green, Vercel production deploy verified, production smoke passed, and tag pushed.
blocks:
  - VibeGear2-implement-mvp-track-0e1b2918
  - VibeGear2-implement-balancing-pass-71a57fd5
  - VibeGear2-implement-cross-browser-7cf643ce
---

## Description

Cut the v0.1 tagged release. Author `CHANGELOG.md` for the version, tag the commit, push the tag, watch the deploy job, smoke-test the deployed URL.

## Context

Phase 6 final task per `docs/IMPLEMENTATION_PLAN.md`. The loop terminates when (a) every GDD section is `Implemented` in PROGRESS_LOG.md, (b) FOLLOWUPS.md has no `blocks-release` items, (c) a tagged release has deployed cleanly. This slice closes (c).

## Affected Files

- `CHANGELOG.md` (new)
- `package.json` (version bump to `0.1.0`)
- Git tag `v0.1.0` (push)
- `docs/PROGRESS_LOG.md` (entry recording the release)

## Edge Cases

- Deploy fails: per `docs/WORKING_AGREEMENT.md` §5, treat as P0; the next slice is a hotfix.
- Smoke test fails on the deployed build: same as above.
- Pre-existing `blocks-release` items in FOLLOWUPS.md: do not release, surface them and resolve first.

## Verify

- [ ] `CHANGELOG.md` lists every shipped slice since project start.
- [ ] `git tag v0.1.0` exists and is pushed.
- [ ] Deploy job for the tag commit succeeds.
- [ ] Visiting the deployed URL boots to title screen and a 1-lap demo race completes.
- [ ] All three loop-termination conditions in `docs/IMPLEMENTATION_PLAN.md` §4 are satisfied.
- [ ] PROGRESS_LOG.md entry added per §6.
