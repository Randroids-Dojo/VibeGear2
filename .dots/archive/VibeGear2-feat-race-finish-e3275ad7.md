---
title: "feat(race): finish-line moment + lap rollover polish (cross-the-line VFX, SFX, brief slow-down)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-05-01T03:25:40.493615-05:00\\\"\""
closed-at: "2026-05-01T13:56:45.658460-05:00"
close-reason: "Merged PR #147. Added lap and finish moments, delayed the natural-finish handoff for payoff, preserved finish SFX during the hold, addressed Copilot review, and verified main CI plus production smoke."
---

The race ends abruptly: src/game/raceSession.ts:1631–1639 flips phase to "finished" and physics freeze on the next tick (lines 955–957 short-circuit), then the results page loads. There is no visible checkered flag, no slow-mo, no celebration beat. Lap rollover (src/game/raceSession.ts:1610–1623) similarly has no presentation moment — just a number change.

The audio events ALREADY EXIST and are wired (raceSession.ts:241–250 declares RaceSessionLapCompleteAudioEvent + RaceSessionRaceFinishAudioEvent; events emitted at lines 1636–1646; src/app/race/page.tsx:272–275 maps to runtime.playLapComplete() and runtime.playResultsStinger()). SFX shapes are stubs (src/audio/sfx.ts:62–68). This slice anchors visual polish to those existing audio hooks.

Production scope (4–6 change surfaces):
1. src/audio/sfx.ts:62–68 — flesh out LapCompleteSfxInput and ResultsStingerSfxInput with proper envelopes (1.5–2s build for finish, 0.8–1.2s for lap). Use the existing procedural oscillator approach (no new audio file dependencies, consistent with PR #68).
2. src/render/pseudoRoadCanvas.ts — add a checkered-flag overlay layer that renders during the lap-complete window (last 50m before start/finish line) and a finish-line ribbon visual on the final lap. Reuse the dust/parallax draw-order pattern, render BEFORE the player overlay so the player car drives through it.
3. src/render/vfx.ts — add particle burst on lap-complete and finish (confetti or sparks). Existing particle system already supports rain/snow/dust; pickups dot will likely add another emitter, so keep the API additive.
4. src/components/hud/* — add FINAL LAP banner shown at lap N-1 → N transition (0.8s flash), and lap counter color shift to red/gold on the final lap.
5. src/game/raceSession.ts:1631–1639 — keep simulation running for 0.5s after finish (slow-mo: scale Δt by 0.4 for those 30 ticks), THEN flip to phase=finished. This makes the cross-the-line visible instead of cut. Pure-function constraint: gate by an explicit slowMoTicks field on session state, not by wall-clock.
6. src/app/race/page.tsx — delay results-page transition by ~700ms after phase flips to finished so the celebration beat plays before the screen changes.

Existing reusable code:
- raceCheckpoints.ts already detects start/finish line crossing (used for lap detection at lines 1–49) — reuse for triggering checkered-flag overlay.
- hudState.ts already clamps and reports current lap (line 141) — extend, dont fork.
- Pause overlay (src/components/pause/PauseOverlay.tsx, PR #76) is a precedent for full-screen overlay timing — pattern transferable.

Open design choices (resolve in dots first slice, not now):
- Final-lap banner timing: at lap-counter increment, or 5s before finish-line cross?
- Checkered-flag style: full-screen swipe vs corner sweep vs minimap pulse?
- Slow-mo: 0.5s at 0.4x is a starting point; tune by feel.

Acceptance criteria (production):
- Final lap visibly distinct on HUD (color or banner) for at least 0.8s.
- Lap-complete moment plays SFX + particle burst, doesnt drop a frame.
- Final cross-the-line slows the sim briefly (0.3–0.7s of slow-mo) and plays a results stinger of 1.5–2s before the results screen loads.
- e2e (existing race spec): no regression in race-ends-and-routes-to-results timing tolerance — bump expected delay budget.
- Determinism: slow-mo uses an explicit ticks field (no wall-clock), so ghost recordings still replay byte-identical.
- Audio respects the audio mix pane (PR #67) — celebration SFX is on the SFX bus, results stinger is on the music bus.
- No layout shift on mobile: HUD banner overlays the canvas, doesnt reflow it.
