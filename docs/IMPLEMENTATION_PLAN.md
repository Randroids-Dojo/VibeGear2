# VibeGear2 Implementation Plan

A long-running, agent-executable plan for turning `GDD.md` and the section files
under `docs/gdd/` into a working, deployed game. The plan is structured as a
**repeating loop** that continues, slice by slice, for as many iterations and
months as needed until the GDD is fully realised, verified, and shipped.

This document describes **what** we are building and **how the work is sliced**.
The companion file `WORKING_AGREEMENT.md` describes **how the agents must
behave** while executing it.

---

## 1. Goals

1. Implement every feature, system, schema, and content asset described in the
   GDD until the game matches the design.
2. Keep the codebase shippable on `main` at all times: every loop ends with a
   green build, automated tests passing, and a successful auto-deploy.
3. Keep the GDD as the single source of truth. When the implementation diverges
   from the GDD, either change the GDD (with a logged decision) or change the
   code — never let them drift silently.
4. Maintain a transparent, auditable trail (`PROGRESS_LOG.md`,
   `OPEN_QUESTIONS.md`, `FOLLOWUPS.md`) so a new agent or human can pick up the
   work mid-flight without context loss.
5. Operate autonomously where possible and pause for human clarification only
   when the GDD is silent, ambiguous, or self-contradictory on a decision the
   agent cannot reasonably make on its own.

## 2. Scope of "the GDD"

The implementation target is everything reachable from `GDD.md`:

- The 28 numbered sections listed in `GDD.md` (sections 18–28 must be authored
  before they can be implemented — see Phase 0).
- Any cross-referenced schema, table, or appendix.
- The `docs/` tree as it grows.

The `GDD.docx` binary is treated as a historical export. The Markdown tree is
canonical.

## 3. Phases

The loop runs through phases. Phases are not strict gates — later phases can
revisit earlier ones — but each phase has a primary focus.

### Phase 0 — Foundations and GDD completion
- Verify all 28 GDD section files exist. Author missing files
  ([`docs/gdd/18-sound-and-music-design.md`](gdd/18-sound-and-music-design.md) through [`docs/gdd/28-appendices-and-research-references.md`](gdd/28-appendices-and-research-references.md))
  by drafting from the parent index and any cross-references, then flagging
  unresolved sections for dev review.
- Stand up the project skeleton described in
  [`docs/gdd/21-technical-design-for-web-implementation.md`](gdd/21-technical-design-for-web-implementation.md): Next.js + TypeScript app,
  lint, type-check, unit-test, end-to-end harness, CI, and a deploy target.
- Wire `PROGRESS_LOG.md`, `OPEN_QUESTIONS.md`, and `FOLLOWUPS.md` so every
  later loop has a place to write.
- Define the JSON schemas in [`docs/gdd/22-data-schemas.md`](gdd/22-data-schemas.md) as TypeScript types and
  runtime validators.

### Phase 1 — Vertical slice (drivable road)
- Pseudo-3D road renderer (Canvas2D) with one straight + one curve track.
- Player car with arcade physics from [`docs/gdd/10-driving-model-and-physics.md`](gdd/10-driving-model-and-physics.md)
  (acceleration, top speed, steering, basic collision feedback).
- Single AI car using the simplest opponent profile from
  [`docs/gdd/15-cpu-opponents-and-ai.md`](gdd/15-cpu-opponents-and-ai.md).
- HUD with speed, lap, and position only.
- Goal: a 30-second drive feels like the design pillars in
  [`docs/gdd/01-title-and-high-concept.md`](gdd/01-title-and-high-concept.md).

### Phase 2 — Race rules and economy
- Full race rules from [`docs/gdd/07-race-rules-and-structure.md`](gdd/07-race-rules-and-structure.md) (countdown, laps,
  placement, DNF rules).
- Damage model from [`docs/gdd/13-damage-repairs-and-risk.md`](gdd/13-damage-repairs-and-risk.md).
- Credits, repairs, and the upgrade categories from
  [`docs/gdd/12-upgrade-and-economy-system.md`](gdd/12-upgrade-and-economy-system.md).
- Garage flow from [`docs/gdd/05-core-gameplay-loop.md`](gdd/05-core-gameplay-loop.md).
- Save / load from [`docs/gdd/21-technical-design-for-web-implementation.md`](gdd/21-technical-design-for-web-implementation.md) (local
  storage MVP).

### Phase 3 — World, tours, and content
- Region and tour structure from [`docs/gdd/08-world-and-progression-design.md`](gdd/08-world-and-progression-design.md).
- Track authoring pipeline using the schema in [`docs/gdd/22-data-schemas.md`](gdd/22-data-schemas.md).
- The track set required by [`docs/gdd/24-content-plan.md`](gdd/24-content-plan.md) for MVP.
- Car set and stats from [`docs/gdd/11-cars-and-stats.md`](gdd/11-cars-and-stats.md).
- Balancing pass against [`docs/gdd/23-balancing-tables.md`](gdd/23-balancing-tables.md).

### Phase 4 — Atmosphere and feel
- Weather and environmental systems ([`docs/gdd/14-weather-and-environmental-systems.md`](gdd/14-weather-and-environmental-systems.md)).
- Sound and music ([`docs/gdd/18-sound-and-music-design.md`](gdd/18-sound-and-music-design.md)).
- Visual polish from [`docs/gdd/16-rendering-and-visual-design.md`](gdd/16-rendering-and-visual-design.md) and [`docs/gdd/17-art-direction.md`](gdd/17-art-direction.md).
- HUD/UX polish from [`docs/gdd/20-hud-and-ui-ux.md`](gdd/20-hud-and-ui-ux.md).

### Phase 5 — Modes, modding, and stretch
- Time trial, daily challenge, and any additional modes in [`docs/gdd/06-game-modes.md`](gdd/06-game-modes.md).
- Track editor and mod loading per [`docs/gdd/26-open-source-project-guidance.md`](gdd/26-open-source-project-guidance.md).
- Optional ghost racing / leaderboard hooks.

### Phase 6 — Hardening and release
- Risks/mitigations sweep from [`docs/gdd/27-risks-and-mitigations.md`](gdd/27-risks-and-mitigations.md).
- Cross-browser, performance, and accessibility verification.
- Versioned release, changelog, and tagged deploy.

## 4. The Loop

Every iteration follows the same shape. A loop is a small, ship-shaped slice —
typically 1–3 days of agent work, never more than what fits in a single PR.

```text
┌─ select slice ──────────────────────────────────────────┐
│  pick the next item from the active phase               │
│  scope it to one PR-sized change                        │
│                                                         │
├─ clarify ───────────────────────────────────────────────┤
│  read the relevant GDD section(s) end to end            │
│  list the concrete GDD requirements touched by the      │
│  slice, including adjacent required behaviour that will  │
│  not be implemented in this PR                          │
│  if anything is ambiguous, write the question into      │
│  OPEN_QUESTIONS.md and either:                          │
│    - block the slice and pick another, or               │
│    - proceed with a clearly-labelled assumption         │
│                                                         │
├─ implement ─────────────────────────────────────────────┤
│  smallest change that satisfies the slice               │
│  write or update tests alongside the code               │
│                                                         │
├─ verify ────────────────────────────────────────────────┤
│  type-check, lint, unit, integration, e2e all green     │
│  for UI/feel changes, run the dev server and exercise   │
│  the feature in a browser; if the agent cannot drive a  │
│  browser, say so and request human verification         │
│                                                         │
├─ clean and refactor ────────────────────────────────────┤
│  remove dead code introduced by the slice               │
│  extract only abstractions justified by ≥3 callers      │
│  invoke /simplify (or equivalent reviewer) before push  │
│                                                         │
├─ document ──────────────────────────────────────────────┤
│  append a PROGRESS_LOG.md entry (template in §6)        │
│  mark resolved OPEN_QUESTIONS.md items answered or      │
│  obsolete (do not delete; history is preserved)         │
│  add any new followups to FOLLOWUPS.md                  │
│  confirm every unmet GDD requirement noticed during     │
│  the slice has a followup or open question              │
│  if implementation forced a GDD change, edit the GDD    │
│  in the same PR and call it out in the log              │
│                                                         │
├─ push and deploy ───────────────────────────────────────┤
│  commit, push the working branch, open/refresh PR       │
│  wait for CI green; auto-deploy from main on merge      │
│                                                         │
└─ repeat ────────────────────────────────────────────────┘
```

The loop terminates only when:
1. Every GDD section is marked `Implemented` in `PROGRESS_LOG.md`, **and**
2. `FOLLOWUPS.md` contains no `blocks-release` items, **and**
3. A tagged release has deployed cleanly and a smoke test of the deployed game
   passes.

Until all three are true, the loop continues.

## 5. Slice selection rules

When picking the next slice the agent should prefer, in order:

1. Anything blocking the current phase's primary focus.
2. Anything that unblocks the most other slices (e.g. shared schemas, shared
   rendering primitives).
3. Items in `FOLLOWUPS.md` flagged `blocks-release`.
4. Items that close `OPEN_QUESTIONS.md` entries the dev has answered.
5. The next unimplemented item in GDD section order.

Never pick a slice the agent does not fully understand from the GDD. File a
question instead.

## 6. PROGRESS_LOG.md entry template

Every loop appends a single entry, newest at the top:

```markdown
## YYYY-MM-DD — Slice: <short title>

**GDD sections touched:** §X.Y, §X.Z
**Branch / PR:** <branch>, #<pr>
**Status:** Implemented | Partial | Reverted

### Done
- bullet, bullet

### Verified
- how it was tested (unit/e2e/manual)

### Decisions and assumptions
- any judgement calls made when the GDD was silent

### Followups created
- link to FOLLOWUPS.md ids

### GDD edits
- list any GDD files modified in this PR and why
```

## 7. OPEN_QUESTIONS.md and FOLLOWUPS.md

- `OPEN_QUESTIONS.md` holds anything blocked on dev input. Each entry has an id
  (`Q-NNN`), the GDD reference, the question, the agent's recommended default,
  and a status (`open`, `answered`, `obsolete`).
- `FOLLOWUPS.md` holds known followup work that did not fit in the slice that
  surfaced it. Each entry has an id (`F-NNN`), a one-line description, the
  triggering loop, and a priority (`blocks-release`, `nice-to-have`, `polish`).

Both files are append-mostly. Do not delete entries — mark them `answered`,
`done`, or `obsolete` so the history is preserved.

## 8. Definition of Done (per slice)

A slice is done when **all** of the following hold:

- [ ] Code compiles and type-checks cleanly.
- [ ] Lint passes with no new warnings.
- [ ] Unit tests for new logic exist and pass.
- [ ] If the slice changes runtime behaviour, an integration or e2e test covers
      the user-visible path.
- [ ] If the slice changes UI/feel, the agent has either driven it in a browser
      or explicitly flagged that it needs human verification in the log.
- [ ] The progress log names the concrete GDD requirements the slice touched
      and any adjacent requirements deliberately left for later.
- [ ] PROGRESS_LOG.md has a new entry.
- [ ] OPEN_QUESTIONS.md and FOLLOWUPS.md reflect the new state.
- [ ] Every unmet GDD requirement discovered while working has either a
      `FOLLOWUPS.md` id or an `OPEN_QUESTIONS.md` id.
- [ ] CI is green on the PR.
- [ ] Auto-deploy succeeds on merge to `main` and the deployed build still
      boots to the title screen.

## 9. Definition of Done (per phase)

A phase is done when every GDD section primarily owned by that phase is marked
`Implemented` in `PROGRESS_LOG.md`, the phase's gameplay goals are demonstrably
met (link to a recorded session or a deployed build), and no `blocks-release`
items remain that point at that phase.

## 10. Living document

This plan is itself subject to the loop. If the GDD changes, or a phase proves
mis-scoped, edit this file in the same PR that motivates the change and note
the edit in `PROGRESS_LOG.md`.
