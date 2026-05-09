---
title: "implement: GitHub issue labels + good-first-issue starter tasks per §26"
status: closed
priority: 5
issue-type: task
created-at: "\"\\\"2026-04-26T02:22:40.568018-05:00\\\"\""
closed-at: "2026-04-29T17:57:57.156780-05:00"
close-reason: "Merged PR #108, seeded issues #102-#107, label sync and CI green, production smoke passed at 00f1b62."
blocks:
  - VibeGear2-implement-contributing-md-0df67cce
---

## Description

Apply the §26 "Suggested issue labels" set to the GitHub repo (physics, renderer, ai, ui-ux, audio, modding, content, legal-review, good-first-issue, help-wanted, performance, bug, design) and seed 5-10 good-first-issue tasks pointing at small contributor-friendly slices. Closes the §25 v1.0 deliverable "contributor starter tasks".

## Context

`docs/gdd/26-open-source-project-guidance.md` lists thirteen suggested labels and `docs/gdd/25-development-roadmap.md` v1.0 phase lists "contributor starter tasks". Without applied labels, contributors have no way to filter; without seeded good-first-issue tasks, the README's contributor pitch has nothing to point at.

The slice is mostly metadata: a YAML labels file the GitHub Actions `crazy-max/ghaction-github-labeler` action applies, plus a docs-only seed of issue templates. Issues themselves are created via `gh issue create` from a script the agent runs once.

This dot is small but cross-cuts contributor-experience. Pair with `implement-contributing-md-0df67cce` and `implement-docs-contributing-65038f89` for the full contributor onboarding set.

## Affected Files

- `.github/labels.yml` (new): YAML list of every §26 label with color + description.
- `.github/workflows/labels.yml` (new): on push to main, sync labels via the github-labeler action.
- `.github/ISSUE_TEMPLATE/good-first-issue.md` (new): a template that pre-fills the good-first-issue label and a starter-task description scaffold.
- `.github/ISSUE_TEMPLATE/bug-report.md` (new): standard bug report template referencing the labels.
- `.github/ISSUE_TEMPLATE/design-discussion.md` (new): GDD-grounded design discussion template referencing GDD sections.
- `docs/CONTRIBUTING.md` (update if extant; depends on `implement-contributing-md-0df67cce`): link to the labels and templates.
- `scripts/seed-good-first-issues.sh` (new): one-shot script that creates 5-10 issues via `gh issue create`. The agent runs it once and never re-runs (the script self-aborts if any of the issue titles already exist).

## Edge Cases

- Repo is private at the time of seeding: skip; document the followup.
- Labels already applied manually in the GitHub UI with different colors: the labels.yml definitions win on the next sync.
- An issue title in the seed script collides with an existing issue: the script no-ops that entry.
- A future contributor closes a seeded issue: the seed script tracks closed-issue state and does not recreate it.

## Verify

- [ ] `.github/labels.yml` lists every §26 label with a color + description.
- [ ] `.github/workflows/labels.yml` runs on push to main and syncs labels.
- [ ] At least 5 good-first-issue tasks exist on the repo after seeding (manual count via `gh issue list --label good-first-issue`).
- [ ] Each seeded issue references a specific GDD section + a small affected-file list.
- [ ] Issue templates render in the GitHub UI without YAML errors.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/gdd/26-open-source-project-guidance.md` (Suggested issue labels)
- `docs/gdd/25-development-roadmap.md` (v1.0 / contributor starter tasks)
