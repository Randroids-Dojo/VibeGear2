# Agent Working Agreement

This is the contract every agent (human or AI) follows while executing
`IMPLEMENTATION_PLAN.md`. The plan says **what** to build; this file says
**how to behave** while building it.

If something here ever conflicts with the plan, the plan wins for *what to
build*; this agreement wins for *how to operate*.

---

## 1. Source of truth

- The Markdown GDD under `docs/gdd/` (and `GDD.md` index) is canonical.
- `GDD.docx` is a historical artefact; do not edit it.
- If code and GDD disagree, fix the disagreement explicitly: either change the
  code or change the GDD, in the same PR, and note it in `PROGRESS_LOG.md`.

## 2. Branching and pushing

- Long-running implementation work happens on
  `claude/gdd-implementation-plan-Z0cpN` and short-lived child branches off
  `main` named `feat/<slice>`, `fix/<slice>`, `chore/<slice>`, or
  `docs/<slice>`.
- Never push directly to `main`. Always go through a PR.
- Every push uses `git push -u origin <branch-name>`. On network failure, retry
  up to 4 times with exponential backoff (2s, 4s, 8s, 16s).
- Force-push only the agent's own short-lived feature branches, never `main`
  or any branch with someone else's commits on it.

## 3. Commits

- One coherent change per commit. Prefer many small commits over one large one.
- Commit message style:

  ```
  <type>(<area>): <imperative summary>

  <why this change exists, not what it does>
  ```

  where `<type>` ∈ `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.
- Never `--amend` a pushed commit. Create a new commit instead.
- Never use `--no-verify` to bypass hooks. If a hook fails, fix the cause.

## 4. PRs and review

- Each slice gets one PR. PR title mirrors the slice title.
- PR body includes:
  - Link to the GDD section(s) implemented.
  - Link to the matching `PROGRESS_LOG.md` entry.
  - Test plan checklist.
  - Any followups created and the ids they got in `FOLLOWUPS.md`.
- Do not open a PR until CI would plausibly pass locally (type-check, lint,
  tests).
- Wait for CI to go green before merging. If CI fails, fix the cause; do not
  retry the same red push hoping for a flake.
- Squash-merge into `main` unless the slice deliberately benefits from
  preserving history.

## 5. Auto-deploy

- `main` is the deploy branch. Every merge to `main` triggers an auto-deploy.
- After merge, the agent must:
  1. Watch the deploy job.
  2. Hit the deployed URL and verify it loads to at least the title screen.
  3. If the deploy or smoke test fails, the immediate next slice is a hotfix —
     no new feature work until the deployed build is healthy again.
- Treat a broken deploy on `main` as a P0. Roll forward with a fix; do not
  revert unless rolling forward would take longer than reverting.

## 6. Verification

For every slice, before marking it done:

- Run the project's lint, type-check, unit, and integration suites.
- For features with a user-visible surface, run the dev server and exercise
  the feature in a real browser. If the agent's environment cannot drive a
  browser, say so explicitly in the log and request manual verification — do
  not claim the UI works.
- For physics, AI, or numeric systems, write a deterministic test that pins
  the behaviour. Floating-point comparisons use tolerances, not equality.
- For data-driven content (tracks, cars, tours), validate against the schema
  defined in `22-data-schemas.md` as part of CI.

## 7. Refactoring

- Refactor *as part of* the slice that touches the code, not as a separate
  invisible cleanup pass.
- Allowed within a slice: rename, inline, extract, dedupe, reorder.
- Not allowed within a slice: speculative abstractions, framework swaps, broad
  reformatting unrelated to the change.
- If a larger refactor is needed, open a `FOLLOWUPS.md` entry and a separate
  PR.
- Run `/simplify` (or the equivalent reviewer pass) on every slice before
  pushing.

## 8. Asking the dev for clarification

The agent **must** stop and ask when:

- The GDD is silent on a decision the agent cannot reverse cheaply (e.g. a
  schema field name that will end up in saved data).
- Two GDD sections contradict each other.
- A balancing number would be guessed and downstream content depends on it.
- A third-party dependency, paid service, or licence choice is required.

The agent **may** proceed with a labelled assumption when:

- The GDD is silent but the choice is local, reversible, and low-stakes.
- A reasonable default exists in `01-title-and-high-concept.md`'s pillars or
  the cited research in `03-top-gear-2-research-summary.md`.

How to ask:

1. Append a `Q-NNN` entry to `OPEN_QUESTIONS.md` with the GDD reference, the
   question, options considered, and the agent's recommended default.
2. If the slice can proceed under the recommended default, proceed and label
   the assumption clearly in `PROGRESS_LOG.md`.
3. If the slice cannot proceed, mark it blocked, pick a different slice, and
   surface the question in the next PR description so the dev sees it.

When the dev answers, mark the entry `answered`, link to the answering commit
or comment, and (if needed) open a slice to apply the answer.

## 9. Logging and continuity

- Every loop appends to `PROGRESS_LOG.md` using the template in
  `IMPLEMENTATION_PLAN.md` §6. Newest entries on top.
- Never delete log entries. Correct mistakes by adding a new entry that
  references the old one.
- A new agent starting cold should be able to read, in order: `README.md`,
  `IMPLEMENTATION_PLAN.md`, `WORKING_AGREEMENT.md`, the most recent dozen
  `PROGRESS_LOG.md` entries, and `OPEN_QUESTIONS.md`, and have enough context
  to pick the next slice. If that ever stops being true, fix the docs in the
  next slice.

## 10. Scope discipline

- One slice = one PR-sized change. If the slice grows past that, split it.
- Do not add features the GDD does not require.
- Do not add error handling for cases the type system or callers already
  prevent.
- Do not add comments that restate the code. Comments are for the non-obvious
  *why*.
- Do not introduce backwards-compatibility shims for code that has no users
  yet.

## 11. Risky and irreversible actions

Always confirm with the dev (via `OPEN_QUESTIONS.md` or PR comment) before:

- Deleting branches or rewriting shared history.
- Dropping or renaming persisted save fields.
- Changing the licence, package name, or deploy target.
- Adding paid third-party services or telemetry.
- Publishing public assets (music, art) under a licence not already approved.

For local, reversible work (file edits, local tests, branch creation on the
agent's own branches) the agent does not need to ask.

## 12. Stopping conditions

The loop stops, and the agent reports completion, only when all three of:

1. Every GDD section is `Implemented` in `PROGRESS_LOG.md`.
2. `FOLLOWUPS.md` contains zero `blocks-release` items.
3. A tagged release has deployed cleanly and the agent has smoke-tested the
   deployed build.

Short of that, the agent keeps looping — across days, weeks, or months — and
treats every loop as the next move in a long game, not the last.

## 13. Tone for log and PR text

- Short, concrete, present tense.
- Lead with what changed and why.
- No marketing language. No emojis unless the dev asks.
- Reference files as `path/to/file.ts:line` so the dev can click through.
