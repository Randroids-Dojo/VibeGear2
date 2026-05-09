---
title: "feat(pickups): on-track cash + nitro top-up pickups (hazard-inverse pattern)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-05-01T03:26:20.679376-05:00\\\"\""
closed-at: "2026-05-01T18:09:43.917463-05:00"
close-reason: "Pickup design, runtime, render feedback, and SFX slices merged and production verified through PR #151"
---

Net new mechanic. The user wants on-track collectibles for moment-to-moment reward. SCOPE DECISION (clarified at planning time): cash + nitro top-ups ONLY. NO fuel mechanic — GDD §3 explicitly warns "avoid reviving Top Gear 1s fuel-and-pit burden unless it serves a very specific mode." Nitro already exists in the physics model so refills slot in cleanly without introducing a new resource type.

This will require a GDD addition (a new short subsection under §10 driving model OR a new §10.5 mid-race resources section) to keep the design canon honest. The autonomous loops first slice should be the GDD update + a short design subdoc, NOT code.

Production scope:

A. Design slice (first PR — design only, no implementation):
- New GDD subsection: pickup taxonomy (cash + nitro), spawn semantics (per-segment authoring, no random spawn — preserves determinism), respawn semantics (per-lap respawn so each lap is identical, simplest determinism), AI awareness (AI ignores pickups in v1; document this), values (nitro: refills 25% of nitro reserve; cash: e.g. 50–200cr per pickup, balanced against §12 race-end reward so pickups are 5–15% of total cash, not the dominant source).
- src/data/schemas.ts — add Pickup schema (z, laneOffset, kind: cash|nitro, value).
- src/road/types.ts — add pickupIds: string[] to CompiledSegment alongside hazardIds.
- Author 2–3 sample pickups in 1–2 MVP tracks for end-to-end testing.

B. Runtime slice (second PR):
- New src/game/pickups.ts — mirror src/game/hazards.ts:33–67 INVERSE PATTERN. Reuse segmentAt() + overlapsLateral() exactly as evaluateHazards does. Output PickupTickEffect { events: PickupCollectedEvent[], collectedIds: Set<string> }.
- src/game/raceSession.ts — call evaluatePickups() each tick alongside evaluateHazards(). Apply effects: cash → accumulate on session.player.cashEarnedThisRace, nitro → top up player.car.nitroReserve (clamped at max). AI pickups: emit event but no effect (v1 design choice).
- Determinism: pickup collectedIds becomes part of session state and ghost-replay state. Add migration path in src/persistence/save.ts (PR #127 has the precedent for save schema bumps).
- Audio: new PickupCollectedAudioEvent → SFX (different pitch for cash vs nitro). Hook through src/audio/sfx.ts and src/app/race/page.tsx.

C. Render slice (third PR):
- public/art/pickups/cash.svg, public/art/pickups/nitro.svg — placeholder SVGs via scripts/generate-placeholder-art.ts (reuse the procedural pipeline).
- src/render/pseudoRoadCanvas.ts — add drawPickups() helper between roadside props and AI cars in the draw order. Z-cull beyond 150m. Hide collected pickups (skip if id in session.collectedPickupIds).
- src/render/vfx.ts — particle burst on collection (gold sparkle for cash, blue/white for nitro).
- HUD ping: cash counter flashes briefly on collection (extend PR #62-style cash delta indicator).

Hazards-inverse-pattern notes (CONFIRMED VIABLE in research):
- evaluateHazards() at src/game/hazards.ts:33–67 already does segmentAt() + overlapsLateral() detection. The pickup module should literally clone that file and invert the effect. Same authoring style, same lookup, same per-tick determinism.

Acceptance criteria (production):
- Pickup spawn data lives in track JSON (no procedural placement) so authors control balance.
- Per-lap respawn: pickups reappear each lap for replayability and determinism. Document this in the GDD subsection.
- Cash from pickups is 5–15% of total race cash on the MVP track at standard difficulty; tune in src/data/economy.ts (existing balance file).
- Nitro pickup tops up reserve by 25% (clamped). Visible feedback: HUD nitro bar animates up.
- Ghost replays remain byte-identical (collection is part of recorded state).
- e2e/pickups.spec.ts (new): drives the player through a known pickup, asserts cash counter increments AND pickup disappears AND nitro bar grows for nitro variant.
- Save-game migration: existing v0.2.0 saves load without crash; new pickup state persists from v0.3.0 forward.
- AI ignores pickups in v1 (documented limitation, not a bug).
- No determinism regression in time-trial PB selector (PR #63).

Open question deferred to first slice: should pickup collection state persist across race retry (e.g., Practice mode keeps streak), or reset every race start? Recommended: reset every race start in v1.
