---
title: "implement: tunnel segments (light adaptation, audio shift, bloom transition) per §9 §16 §18"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T03:22:30.446328-05:00\\\"\""
closed-at: "2026-04-29T12:57:41.997463-05:00"
close-reason: "Implemented authored tunnel segment metadata, light adaptation, and audio filter spec in PR #95; merged and deployed."
blocks:
  - VibeGear2-implement-visual-polish-7d31d112
  - VibeGear2-implement-sound-music-1611f9dd
  - VibeGear2-implement-parallax-bands-c1bf44c4
---

## Description

Implement tunnel segments as a §9 hazard plus §16 visual feature plus §18 audio cue. §9 lists "tunnel light adaptation" under hazards. §16 lists "tunnel mouths" under roadside objects. §18 lists tunnels as triggering an "audio shift". The MVP track set includes `iron-borough/rivet-tunnel`, so this dot owns the tunnel-segment runtime end-to-end.

## Context

Tunnels are an authoring affordance and a multi-system runtime: the renderer crossfades from sky parallax to a dark vault for the tunnel length, the audio bus applies a low-pass + reverb tail until exit, and the headlight-bloom VFX (§16 "headlight-like bloom pools at night") engages. Without a dedicated dot, each system would invent its own tunnel hook.

Currently no dot covers tunnel runtime. `implement-parallax-bands-c1bf44c4` ships sky / mountain / hill bands but not the tunnel cover. `implement-vfx-flash-3d33b035` ships shake + flash but not bloom. `implement-sound-music-1611f9dd` covers music + base SFX but doesn't pin tunnel filtering.

## Affected Files

- `src/game/tunnelState.ts` (new): pure state machine. `TunnelState = "open" | "entering" | "inside" | "exiting"`. Driven by the player's segment-index transitioning into / out of segments tagged `inTunnel: true`. `step(state, dt, inTunnelFlag) => TunnelState` plus `tunnelOcclusion(state, transitionMs=400) => 0..1`.
- `src/game/__tests__/tunnelState.test.ts` (new): transition fixtures.
- `src/data/schemas.ts` (update): `TrackSegment.inTunnel?: boolean` and `TrackSegment.tunnelMaterial?: string` (references `regions[regionId].tunnelMaterials`). Backwards-compat: optional, defaults `false` / undefined.
- `src/render/tunnelRenderer.ts` (new): given a `TunnelState` + occlusion 0..1, draws the dark vault overlay across the parallax bands. Reuses palette from §17 "tunnel material set".
- `src/audio/tunnelBus.ts` (new): pure audio-graph spec. `applyTunnelFilter(audioBus, occlusion)` returns a new bus config with low-pass cutoff and reverb send scaled by occlusion. The actual Web Audio wiring lives in `implement-sound-music-1611f9dd`; this dot ships the spec.
- `src/render/__tests__/tunnelRenderer.test.ts` (new): mock-canvas drawcall snapshot per occlusion value.
- `src/data/tracks/iron-borough/rivet-tunnel.json` (update): mark the tunnel segment range with `inTunnel: true`. Authoring example for the rest of the track set.
- `src/road/__tests__/trackCompiler.test.ts` (update): assert the tunnel flag survives compilation.

## Edge Cases

- Tunnel length under transition window (~400 ms): `tunnelOcclusion` should still ramp; collapse `entering -> inside -> exiting` cleanly without flicker.
- Player reverses out of a tunnel: state machine handles bidirectional transitions.
- Reduced-motion / a11y: the visual flash component of tunnel-entry is gated on `settings.reduceMotion === false` (per §19 a11y options); the dim-overlay still applies.
- Audio mute: tunnel-bus filter is bypassed if the audio system is muted; rendering still applies.
- Tunnel hazard interaction: per §9 "tunnel light adaptation" is itself a hazard kind handled by `implement-hazards-runtime-...`; this dot focuses on the segment-flag and the rendering / audio response, not on a damage band.

## Verify

- [ ] `step(state="open", dt, inTunnelFlag=true)` returns "entering"; subsequent ticks until `transitionMs` elapses progress to "inside".
- [ ] `tunnelOcclusion("entering", elapsedMs=200)` returns 0.5 (half ramp); `"inside"` returns 1.0; `"open"` returns 0.0.
- [ ] Track schema: a track JSON with `inTunnel: true` on three segments compiles, and the compiled segments preserve the flag.
- [ ] `tunnelRenderer.draw(ctx, occlusion=0.5)` issues exactly one `fillRect` over the parallax band region with alpha 0.5; mock-canvas asserts the call shape.
- [ ] `applyTunnelFilter(bus, occlusion=1.0)` returns a config with low-pass cutoff <= 1500 Hz and reverb send >= 0.5; cell-level fixture.
- [ ] Reduced-motion gate: with the setting on, `tunnelRenderer.draw` issues only the dim-overlay calls (no flash drawcalls).
- [ ] Bidirectional: a fixture that exits and re-enters a tunnel within 1 s produces correct state transitions.
- [ ] Determinism: same input -> same output (no Date.now, no Math.random).
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/game/tunnelState.ts src/render/tunnelRenderer.ts src/audio/tunnelBus.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/09-track-design.md` Hazards (tunnel light adaptation), Roadside scenery (tunnel segments)
- `docs/gdd/16-rendering-and-visual-design.md` Roadside objects (tunnel mouths), Animation and effects (bloom)
- `docs/gdd/18-sound-and-music-design.md` Vehicle and race SFX (tunnel audio shift)
- `docs/gdd/24-content-plan.md` (Iron Borough rivet-tunnel)
