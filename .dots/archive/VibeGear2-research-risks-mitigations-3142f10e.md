---
title: "research: risks + mitigations sweep per §27"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:53.040328-05:00\\\"\""
closed-at: "2026-04-26T01:49:46.308768-05:00"
close-reason: audited §27; created six implement dots covering content-lint, content-budget, performance-settings, physics-feel benchmarks, full AI archetypes, and palette system
blocks:
  - VibeGear2-implement-phase-1-7aef013d
---

Read docs/gdd/27-risks-and-mitigations.md and audit current implementation against each risk. Output: research/implement dots for any unaddressed mitigation.

## Findings

GDD §27 lists seven risks. For each, this audit confirms (a) which existing dots cover the named mitigation and (b) which mitigation language is currently unaddressed in the dot set. The Phase 1 vertical-slice dot is `blocks`-targeted because the audit must complete before Phase 6 hardening can claim coverage; in practice the gap dots created here are Phase 4 / 5 / 6 work and do not block Phase 1 from shipping a drivable demo.

### Risk-by-risk audit

1. **Legal / IP drift.** Mitigation: "Strong contribution rules, originality checklist, content linting."
   - Contribution rules: covered by `implement-contributing-md-0df67cce` (PR confirmation checklist with originality box, asset manifest rule).
   - Originality checklist: covered twice. `implement-legal-safety-77d61769` ships the binding catalogue of safe / unsafe patterns, and `implement-mod-loader-e9b8b51f` rejects mod manifests missing `originalityStatement`.
   - Content linting: GAP. `implement-legal-safety-77d61769` §9 names `scripts/content-lint.ts` but defers it to a follow-up. No dot exists. Created `implement-content-lint-script` this iteration.

2. **Scope creep.** Mitigation: "Lock v1.0 at 32 tracks and 6 cars."
   - Authoring is covered by `implement-mvp-track-0e1b2918` (8-track MVP) and `implement-car-set-cd1ec10c` (6 cars). `docs/gdd/24-content-plan.md` lists the 32 tracks for v1.0.
   - CI lock: GAP. No test asserts that `src/data/tracks/**` does not exceed 32 entries or `src/data/cars/**` does not exceed 6 entries. Without this, scope explosion ships silently. Created `implement-content-budget-tests` this iteration.

3. **Browser performance.** Mitigation: "Adjustable draw distance, sprite density, pixel ratio caps."
   - Performance verification covered by `implement-cross-browser-7cf643ce` (Phase 6 sweep, profiling).
   - The renderer already has `DRAW_DISTANCE` as a `src/road/constants.ts` constant.
   - User-facing adjustment UI: GAP. `implement-hud-ui-6c1b130d` settings page covers units / assists / audio levels but not performance. No dot wires the three named knobs (draw distance, sprite density, pixel ratio cap) to a settings UI plus a persisted save field plus a runtime read in the renderer. Created `implement-performance-settings` this iteration.

4. **Physics feel.** Mitigation: "Fixed-step sim, tight prototyping, replayable benchmark tracks."
   - Fixed-step sim: covered by `src/game/loop.ts` (already shipped in `feat/fixed-step-loop` per the loop instructions).
   - Tight prototyping: implicit in the loop shape (`docs/IMPLEMENTATION_PLAN.md` §4).
   - Replayable benchmark tracks: GAP. No dot calls out a small set of physics-feel benchmark tracks that the team can drive through manually after each tuning change to gut-check feel, nor a recorded ghost replay over each that fails the build if a tuning change moves lap time more than a threshold. The `track-compiler` golden-master suite covers compilation determinism, not physics feel. Created `implement-physics-benchmark-tracks` this iteration.

5. **AI frustration.** Mitigation: "Light rubber banding, visible AI archetypes, deterministic tuning."
   - Deterministic tuning: covered by `implement-single-ai-4cdd40cd` (pure function, replay-determinism test).
   - Visible AI archetypes: GAP. §15 names six archetypes (rocket starter, clean line, bully, cautious, chaotic, enduro). The single-ai dot ships only `clean_line`. No dot ships the other five and the archetype-selection routine that builds a grid. Created `implement-ai-archetypes` this iteration.
   - Light rubber banding: GAP. §15's rubber-banding philosophy and difficulty tiers (Easy / Normal / Hard / Master) are not in any existing dot. Folded into the new `implement-ai-archetypes` dot scope.

6. **Asset burden.** Mitigation: "Palette-driven reuse, modular prop kits, background layering."
   - Background layering: covered by `implement-visual-polish-7d31d112` (parallax bands).
   - Sprite atlas: covered by `implement-visual-polish-7d31d112`.
   - Palette-driven reuse: GAP. §16 describes per-region rich palettes and reserved systemic colours; no existing dot defines the palette JSON format, the per-region palette files, or the runtime that recolours shared sprite atlases. This is the asset-burden mitigation in GDD §27. Created `implement-palette-system` this iteration.
   - Modular prop kit packaging is implied in `implement-visual-polish-7d31d112` (sprite atlas + categorised roadside objects per §16); not a separate gap.

7. **Community moderation.** Mitigation: "Manual curation, manifest requirements, report tools."
   - Manifest requirements: covered by `implement-mod-loader-e9b8b51f` (rejects manifests missing required fields).
   - Manual curation: covered by `implement-modding-md-efbf1c83` ("submitting a mod" is a maintainer-reviewed PR for v1.0).
   - Report tools: GAP, but post-v1.0. GDD §27 names "report tools" as a mitigation. No dot specifies the user-facing report flow on the (future) public mod browser. The browser itself is post-v1.0 per `implement-modding-md-efbf1c83` §1, so the report-tool design is also post-v1.0; captured here as a `FOLLOWUPS.md` candidate when the mod-browser slice opens. No dot created.

### Decisions

- Six new `implement:` dots created this iteration, each tied to one or more risks above:
  1. `implement-content-lint-script` (Legal / IP drift content-linting).
  2. `implement-content-budget-tests` (Scope creep CI lock).
  3. `implement-performance-settings` (Browser performance adjustable knobs).
  4. `implement-physics-benchmark-tracks` (Physics feel benchmarking).
  5. `implement-ai-archetypes` (AI frustration archetypes + rubber banding + difficulty tiers).
  6. `implement-palette-system` (Asset burden palette-driven reuse).
- The community-moderation report-tool gap is documented above but not turned into a dot, because the public mod browser it lives on is post-v1.0 and out of the current loop's scope. The note is preserved in this findings block so a future audit can pick it up.

### Rationale

- Each new dot maps to a specific clause of the §27 mitigation text. Where the mitigation is one phrase ("content linting"), one dot covers it. Where the mitigation has multiple distinct sub-clauses (the AI row), the dots collapse compatible sub-clauses to keep the dot count proportional to risk surface.
- The dots were created at priority 4 (release hardening) because §27 is itself a Phase 6 sweep per `IMPLEMENTATION_PLAN.md`. They do not block earlier-phase work; they do block `tagged-release-b3d30084` via the existing blocking edges from `mvp-track`, `balancing-pass`, and `cross-browser` (no extra wiring required from the new dots).
- Existing dots that already cover a mitigation are NOT modified; the audit cross-references them rather than duplicating their scope. This keeps the dot graph clean.
