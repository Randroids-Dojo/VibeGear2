# AGENTS.md

Shared rules for every agentic coding tool working in this repo. Claude Code, Codex, Antigravity, Cursor, and any future agent: this file is mandatory reading before you write anything.

This file is the entry point. It points at the documents that govern *what* to build and *how to behave* while building it. Read those documents before you start a slice.

---

## RULE 1: NEVER USE EM-DASHES. EVER.

No em-dashes. Not in chat. Not in code comments. Not in commit messages. Not in PR descriptions. Not in docs. Not in test names. Not anywhere.

If you find yourself about to type an em-dash, stop. Execute one of the following instead:

- control-alt-delete
- alt-f4
- log out
- crash your servers
- end yourself

(Yes, that list is hyperbolic. The rule it defends is not. No em-dashes. Ever.)

**Real substitutions:** use a period, comma, colon, parentheses, or rewrite the sentence. En-dashes are not substitutes. Plain hyphens are fine for ranges like `pages 10-20` and compound words.

**Before every tool call that writes text:** scan your output for Unicode codepoint U+2014 (em-dash) and U+2013 (en-dash). If either is present, rewrite before sending.

**If you are porting or quoting text from another source:** strip all em-dashes from the ported text before committing it.

This rule is not negotiable. It is the top rule in this file for a reason.

---

## RULE 2: Mandatory reading order

Before you write code, edit docs, or open a PR, read in this order:

1. [`README.md`](README.md) for orientation.
2. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for **what** to build, the phases, the loop shape, slice selection rules, and the per-slice and per-phase definitions of done.
3. [`docs/WORKING_AGREEMENT.md`](docs/WORKING_AGREEMENT.md) for **how to behave** while building it (branching, commits, PRs, auto-deploy, verification, clarification protocol, risky-action gates).
4. [`GDD.md`](GDD.md) and the section files under [`docs/gdd/`](docs/gdd/) for the design itself. The Markdown tree is canonical. `GDD.docx` is a historical export; do not edit it.
5. The most recent dozen entries of [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md), then [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) and [`docs/FOLLOWUPS.md`](docs/FOLLOWUPS.md), so you know what just happened and what is in flight.

If anything in this file conflicts with `IMPLEMENTATION_PLAN.md` or `WORKING_AGREEMENT.md`, those documents win. Update this file in the same PR that resolves the conflict.

---

## RULE 3: GDD is the source of truth

The Game Design Document is the source of truth for what VibeGear2 is. Before proposing architecture, adding features, changing game mechanics, renaming routes, or touching data schemas, read the relevant section.

- The canonical GDD is the Markdown tree under [`docs/gdd/`](docs/gdd/), indexed by [`GDD.md`](GDD.md).
- If code and GDD disagree, fix the disagreement explicitly: change the code or change the GDD in the same PR, and note it in [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md) under the slice's `GDD edits` section.
- Validate data-driven content against the schemas in [`docs/gdd/22-data-schemas.md`](docs/gdd/22-data-schemas.md).
- If the GDD is silent or self-contradictory on a decision you cannot reverse cheaply, follow the clarification protocol in `WORKING_AGREEMENT.md` §8: file a `Q-NNN` entry in `OPEN_QUESTIONS.md`, recommend a default, and either proceed under the labelled assumption or block the slice.

---

## RULE 4: One slice, one branch, one PR

Implementation work runs the loop in `IMPLEMENTATION_PLAN.md` §4. Each loop iteration is one ship-shaped slice that fits in a single PR.

- Branch off `main` as `feat/<slice>`, `fix/<slice>`, `chore/<slice>`, or `docs/<slice>`. One branch per slice. Delete after merge.
- Create short-lived branches from `main` named `feat/<slice>`, `fix/<slice>`, `chore/<slice>`, or `docs/<slice>`.
- Never push directly to `main`. Always go through a PR.
- Commit messages follow the `<type>(<area>): <imperative summary>` format from `WORKING_AGREEMENT.md` §3. Lead the body with *why*, not *what*.
- Never `--amend` a pushed commit. Never `--no-verify`. Never force-push `main` or any branch with someone else's commits on it.
- Do not bypass checks with `--no-verify`.
- PR title mirrors the slice title. PR body links the GDD section(s) implemented, the matching `PROGRESS_LOG.md` entry, the test plan, and any followups created.
- Wait for CI green before merging. Squash-merge into `main` unless the slice deliberately benefits from preserving history.

`main` is the deploy branch. After merge, watch the deploy job and verify the deployed build still boots to the title screen. A broken deploy on `main` is a P0; the immediate next slice is a hotfix.

---

## RULE 5: Always log the loop

Every slice ends with three writes:

- A new entry at the top of [`docs/PROGRESS_LOG.md`](docs/PROGRESS_LOG.md) using the template in `IMPLEMENTATION_PLAN.md` §6.
- Any unresolved decisions appended to [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) as `Q-NNN` entries; resolved entries marked `answered` or `obsolete` (never deleted).
- Any deferred work appended to [`docs/FOLLOWUPS.md`](docs/FOLLOWUPS.md) as `F-NNN` entries with a priority (`blocks-release`, `nice-to-have`, `polish`); finished entries marked `done` (never deleted).

A new agent starting cold should be able to read `README.md`, `IMPLEMENTATION_PLAN.md`, `WORKING_AGREEMENT.md`, the most recent dozen `PROGRESS_LOG.md` entries, and `OPEN_QUESTIONS.md`, and pick the next slice with full context. If that ever stops being true, fix the docs in the next slice.

---

## RULE 6: When in doubt, ask. And prefer simple consistent flows.

- When a UX decision could go branchy (different behavior per route, per state, per user), default to one consistent rule across all cases.
- Always explain to the user why you are prompting them for input.
- If requirements are ambiguous, file a `Q-NNN` in `OPEN_QUESTIONS.md` per `WORKING_AGREEMENT.md` §8 rather than guessing. Use `AskUserQuestion` for live conversational ambiguity.
- See `WORKING_AGREEMENT.md` §11 for the list of irreversible actions that always require dev confirmation (deleting branches, dropping persisted save fields, changing licence or deploy target, adding paid services or telemetry, publishing assets under a new licence).

---

## RULE 7: Secrets and environment variables

- Never commit `.env`, `.env.local`, or any file containing credentials.
- Never print secret values in logs, chat, or commit messages.
- Local saves are the MVP per [`docs/gdd/21-technical-design-for-web-implementation.md`](docs/gdd/21-technical-design-for-web-implementation.md). Backend services (leaderboard, ghost, signed lap submissions) are optional later phases. Add env vars only when the corresponding feature lands. Document any new env var in the slice's PR body and in [`docs/gdd/21-technical-design-for-web-implementation.md`](docs/gdd/21-technical-design-for-web-implementation.md) if it is part of the architecture.

---

## RULE 8: Testing expectations

Per `IMPLEMENTATION_PLAN.md` §8 and `WORKING_AGREEMENT.md` §6:

- New pure game-logic code (anything in `src/game/`) must have Vitest unit tests. Physics, AI, damage, economy: deterministic tests with float tolerances, not equality.
- New API routes must have at least one Vitest test against the route handler plus one Playwright smoke.
- Track compilation gets golden-master tests. Ghosts get deterministic replay tests.
- For UI or feel changes, drive the dev server in a real browser and exercise the change. If the agent's environment cannot drive a browser, say so explicitly in the log and request manual verification. Do not claim the UI works.
- Do not mark a task complete with failing tests, lint warnings, or red CI.

---

## RULE 9: Scope discipline

- One slice = one PR-sized change. If the slice grows past that, split it.
- Do not add features the GDD does not require.
- Do not add error handling for cases the type system or callers already prevent.
- Do not add comments that restate the code. Comments are for the non-obvious *why*.
- Do not introduce backwards-compatibility shims for code that has no users yet.
- Refactor *as part of* the slice that touches the code, not as a separate invisible cleanup pass. If a larger refactor is needed, file an `F-NNN` and a separate slice. Run `/simplify` (or the equivalent reviewer pass) before pushing.

---

## Quick pre-commit checklist

1. No em-dashes. Run `grep -rn $'\u2014' .` (checks for codepoint U+2014). Must return nothing.
   Do not use em-dashes or en-dashes anywhere.
2. No AI attribution in the commit message or PR body.
3. Lint, type-check, unit, integration, and e2e suites all pass locally.
4. New game-logic, route, and content code has tests per RULE 8.
5. GDD is still accurate, or updated in the same PR.
6. `PROGRESS_LOG.md` has a new entry. `OPEN_QUESTIONS.md` and `FOLLOWUPS.md` reflect the new state.
7. No secrets in the diff.
8. Branch name and commit messages follow `WORKING_AGREEMENT.md` §2 and §3.

See [`docs/SCRIPTS.md`](docs/SCRIPTS.md) for the full npm script reference.
See [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) when local setup or test runs fail.
