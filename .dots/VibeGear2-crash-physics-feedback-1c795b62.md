---
title: "Crash physics + feedback: make collisions feel like collisions"
status: open
priority: 1
issue-type: task
created-at: "2026-05-10T03:27:20.607758-05:00"
---

Background

The fix/race-readability-bundle PR (#221) traced the "AI cars stop ahead" complaint to a 12-car grid pile-up: every AI steered toward the centerline-anchored racing line, all converged in <2 seconds, accumulated damage to >=0.95 wreck threshold, then status flipped to dnf and physics froze. To the player, this looks like cars driving straight and stopping. No screech, no spark, no knock, no debris, no HUD beat. The launch-phase lane-hold in 8187062 stops the pile-up, but the deeper issue is that crashes have no presence even when they happen.

Goal

Make a collision read as a collision: visually, audibly, mechanically. Two cars touching should feel like contact. A car wrecking should not silently freeze.

Research

1. Audit src/game/raceSession.ts contact-pair scan around line 1689 (carHit event generation) and src/game/raceRules.ts wreck threshold (WRECK_THRESHOLD = 0.95). Map every place a hit/wreck event fires.
2. Map current collision feedback surface area: src/render/vfx.ts (flash + shake), src/audio (any hit/crash cues), HUD (damage bar, no event log). Identify where each event type currently lands. Most likely: only the player path triggers shake/flash; AI-vs-AI events have no visual.
3. Compare to Top Gear 2 reference (per docs/RESEARCH_TOPGEAR_FUN_PLAN.md): hit-flash on contact, brief screen punch on hard hit, audio thud, smoke or debris on heavy wreck, the wrecked car sometimes spins or coasts off-line for a second before settling.

Fix scope (suggested slices)

- Slice 1: AI-vs-AI carHit events trigger localised VFX (a sprite-anchored flash or dust puff at the contact midpoint). Wire into existing vfx state.
- Slice 2: Wreck transition has a "death animation" - the wrecking car's status flips to dnf, but for ~0.6 s before physics freezes, it spins or drifts to the rumble. Visual + audio cue at the moment of wreck.
- Slice 3: Audio: collision thud cue (per src/audio engine API) and a deeper wreck-stinger cue, both gated behind reduced-motion / accessibility settings if relevant.
- Slice 4: Lateral knock-back amplitude: the existing F-102 BUMP_KICK_BASE_MPS may be too small to read on-screen; verify by instrumenting and bumping until contact feels percussive.

Verification

- Browser playthrough: every contact pair produces a visible flash and audio cue; every wreck produces a distinct stinger and a brief death animation.
- New e2e or unit pin: at race start with the launch-lane-hold off (or simulated bump), AI cars in contact emit at least one hit event and the renderer's vfxState shows a flash entry.
- Player feel: bumping a CPU at speed should feel like a clear thump, not a silent damage tick.

Constraints

- AGENTS.md RULE 8: replays must remain deterministic. Any per-frame VFX seed has to come from the seeded PRNG, not Math.random.
- Reduced-motion gate (per docs/gdd/19-controls-and-accessibility.md) still applies to shake.
- This is the dependent of follow-up F-NNN that wants to keep the pile-up fix from regressing; reference 8187062 in the slice 1 PR.
