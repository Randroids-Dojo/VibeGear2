---
title: "implement: F-022 ghost car consumer (Time Trial route + recorder lifecycle) per §6 GDD"
status: closed
priority: 2
issue-type: task
created-at: "\"2026-04-26T14:41:19.147256-05:00\""
closed-at: "2026-04-26T18:35:10.694703-05:00"
close-reason: "Wired Time Trial ghost consumer: /time-trial route, title entry, race shell timeTrial mode, saved ghost playback, recorder PB persistence, and no-economy finish path. Verified lint, typecheck, unit tests, content-lint, build, title-screen e2e, diff check, and dash scan."
---

blocks: implement-time-trial-5d65280a (owns Time Trial recorder lifecycle). Drawer side already landed in e685db4 (drawRoad accepts ghostCar prop with screenX/screenY/screenW + alpha + fill). Consumer side still owed by §6 Time Trial route.

The §6 Time Trial route still needs to:
1. Compile a Replay from save.ghosts[track.id] via bestGhostFor(current, candidate) in src/game/ghost.ts.
2. Instantiate createPlayer(replay) on the green-light tick.
3. Drive a second step() call per tick from player.readNext(tick) against a separate CarState.
4. Project the ghost (z, x) to screen via the same segmentProjector.project strip math the road draw uses (mirrors §20 minimap convention).
5. Pass the projected (screenX, screenY, screenW) plus alpha into the ghostCar prop on drawRoad.

Atlas-frame upgrade is deferred to land alongside the live-car LoadedAtlas wiring (both render as placeholders today; pair the upgrades so live / ghost differentiation stays consistent). Until then the fill override on the prop lets the consumer pin a per-car tint without touching the renderer.

Affected files:
- src/app/(routes)/practice/timetrial/page.tsx (or equivalent Time Trial route under src/app/): instantiate createPlayer on green-light; per-tick drive ghost step + project + pass ghostCar prop.
- src/game/ghost.ts (already exports createPlayer, bestGhostFor, Replay): no edits expected.
- src/render/pseudoRoadCanvas.ts (already accepts ghostCar prop): no edits expected.
- src/road/segmentProjector.ts (already exports project): no edits expected.
- docs/FOLLOWUPS.md: F-022 marked done.

Verify:
- npm run lint, typecheck, test, build all clean.
- Time Trial green-light tick instantiates a ghost from save.ghosts[track.id]; the ghost rect lands on the road plane and follows the recorded path.
- A track with no recorded ghost (save.ghosts[track.id] undefined) skips ghost rendering with no console warnings.
- After a faster lap completes, bestGhostFor swaps the persisted ghost; a subsequent run renders the new (faster) replay.
- F-022 marked done in docs/FOLLOWUPS.md.
- No em / en-dashes in changed files.
