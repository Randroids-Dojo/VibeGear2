---
title: "research: audit and standardise dot dependency metadata"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T01:33:37.765806-05:00\\\"\""
closed-at: "2026-04-26T01:42:06.650836-05:00"
close-reason: "Confirmed dot CLI only honors blocks:; converted 5 after: dots, dropped 6 stale archived refs, fixed 4 archive paths"
---

Audit all open implement: dots for stale, missing, or wrong-direction dependency frontmatter. Existing dots use both 'blocks:' (read as 'after / depends on') and 'after:' inconsistently (3 dots use 'after:'; 22 use 'blocks:'). Six open dots have 'blocks:' refs to already-archived dots (fixed-step, data-schemas, research-pseudo-3d). Phase-1 dot lists keyboard-gamepad/single-ai/minimal-hud under 'blocks:' but the semantic is 'phase-1 depends on these', which is consistent with the 'blocks:'-as-'after' convention. Output: a normalisation plan (single field name, listing direction documented in AGENTS.md), followed by an implement dot that rewrites the frontmatter across all open dots. Do NOT touch dots whose owners are actively in flight per the iteration prompt.

## Findings

### How the `dot` CLI actually parses dependency frontmatter

Inspected the `dot` 0.6.4 binary (at `/Users/randroid/.local/bin/dot`). The recognised frontmatter fields are exactly:

- `status`
- `priority`
- `assignee`
- `blocks`

There is **no `after:` field**. Dots written with `after:` had their dependency edges silently dropped. The `dot ready` filter treats a dep as "satisfied" when its target's status is `closed` or `active`; only `open` deps gate readiness. The CLI does NOT persist dep edges in any state store; it re-parses each `.md` frontmatter on every command.

### Convention going forward

Use `blocks:` for dependency frontmatter. The semantic is "I am blocked by these IDs" (i.e. `blocks` reads as "blocked-by", not the dictionary "I block these"). This is counter-intuitive but it is what the CLI implements; the iteration prompt's "blocks-as-after" reading is correct.

### Fixes applied this iteration

1. **Converted `after:` to `blocks:` in 5 open dot files** so their dep edges are honored:
   - `VibeGear2-implement-contributing-md-0df67cce.md` (deps: licence-files, legal-safety)
   - `VibeGear2-implement-legal-safety-77d61769.md` (dep: licence-files)
   - `VibeGear2-implement-modding-md-efbf1c83.md` (deps: licence-files, mod-loader)
   - `VibeGear2-implement-mod-loader-e9b8b51f.md` (deps: licence-files, 11995c69)
   - `VibeGear2-implement-track-editor-fdb02792.md` (deps: pseudo-3d, 11995c69 -> just 11995c69 after stale-ref drop)

   Verified before/after: `dot ready` correctly excluded these 5 dots after the fix because `licence-files-a7c7b931` is `active` (and pseudo-3d / 11995c69 are still pending). Pre-fix, all 5 incorrectly appeared in `dot ready` despite having open prerequisites.

2. **Dropped stale `blocks:` references to archived dots** in 6 open dot files (cleans noise; archived = closed = satisfied so this was a no-op for `dot ready`):
   - `VibeGear2-implement-arcade-physics-2efae8b6.md` (dropped fixed-step-c30a9a7c)
   - `VibeGear2-implement-keyboard-gamepad-6ff1e38c.md` (dropped fixed-step-c30a9a7c)
   - `VibeGear2-implement-ghost-replay-7ea6ffaa.md` (dropped fixed-step-c30a9a7c)
   - `VibeGear2-implement-sound-music-1611f9dd.md` (dropped fixed-step-c30a9a7c)
   - `VibeGear2-implement-visual-polish-7d31d112.md` (dropped pseudo-3d-d4c30840)
   - `VibeGear2-implement-track-editor-fdb02792.md` (dropped pseudo-3d-d4c30840 from blocks list, kept 11995c69)

3. **Fixed stale body-text path references** to research dots that have moved to `.dots/archive/`:
   - `VibeGear2-implement-11995c69.md` -> `.dots/archive/VibeGear2-research-track-authoring-ebc66903.md`
   - `VibeGear2-implement-mod-loader-e9b8b51f.md` -> `.dots/archive/VibeGear2-research-track-editor-0c0353df.md`
   - `VibeGear2-implement-modding-md-efbf1c83.md` -> `.dots/archive/VibeGear2-research-track-editor-0c0353df.md`
   - `VibeGear2-implement-track-editor-fdb02792.md` -> `.dots/archive/VibeGear2-research-track-editor-0c0353df.md`

### Left intentionally untouched

- `licence-files-a7c7b931.md` (status `active`): body-text reference to `.dots/VibeGear2-research-licence-selection-4086fb7d.md` (now in archive). Active dot owned by another agent, leave alone per iteration policy. The reference is human-readable and still findable.
- `car-set-cd1ec10c.md` (status `active`): `blocks: data-schemas-4dd373bc` (archived). Active dot, harmless ref (closed-target = satisfied).
- `weather-38d61fc2.md` `blocks: arcade-physics` is loose (weather logically depends on `phase-1` integration), but tightening dep graph is out of scope for this audit. Filed under "consider in next research dot".

### State after fixes

`dot ready` returns 6 truly-unblocked open dots:
- arcade-physics, keyboard-gamepad, 11995c69 (track compiler), sound-music, visual-polish, ghost-replay

Active: licence-files, car-set, research-audit (this dot, about to close).

### Recommendation for AGENTS.md

Add a short "Dot frontmatter conventions" subsection (post-merge, separate slice) documenting:
- The only honored dep field is `blocks:` (semantic: "this dot is blocked by the listed IDs").
- Don't reference archived dots in `blocks:` (no functional effect, but pollutes audits).
- Body-text references to archived dots should use the `.dots/archive/` path.

Filing this as an `F-NNN` followup rather than spawning a new dot, since the doc edit is trivial and can ride along with the next docs slice.
