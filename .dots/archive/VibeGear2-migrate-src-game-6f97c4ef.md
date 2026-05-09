---
title: Migrate src/game/rng.ts to @randroids-dojo/vibekit/rng
status: closed
priority: 2
issue-type: task
created-at: "\"2026-05-08T23:29:09.657767-05:00\""
closed-at: "2026-05-09T15:11:08.775650-05:00"
close-reason: deferred to VibeKit v0.2.0; see VibeKit-lift-vibegear2-rng-6a36f21e
---

VibeGear2 has a dedicated rng.ts module for replay determinism. ../VibeKit/src/rng.ts is the canonical Mulberry32 implementation with extra helpers (range, pick, gauss). Compare APIs: if VibeGear2's rng exports a superset, push the missing helpers up to VibeKit first; if VibeKit's API covers VibeGear2's, replace the local module with a re-export from @randroids-dojo/vibekit. Add @randroids-dojo/vibekit as a file:../VibeKit dep. Replay determinism contract in §21 of the GDD must keep passing.
