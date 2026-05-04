# Release-Fun Playtest Checklist

Date: 2026-05-02

This checklist defines the repeatable playtest that agents must run before
calling VibeGear2 fun and releasable. It complements automated CI. It checks
whether the default path communicates the arcade-racer promise without the
player reading docs.

## Required Evidence

Every run records:

- Git SHA or `/api/version` value.
- Route under test.
- Browser and viewport.
- Track, mode, weather, tire selection, and car.
- Pass or fail for each checkpoint.
- Screenshot or video path for any visual failure.
- Any manual observation that automation cannot yet assert.

## Automated Command

Run:

```bash
npm run playtest:release-fun
```

The command runs `e2e/release-fun-playtest.spec.ts` with
`RELEASE_FUN_PLAYTEST=1` against a production Next.js build. It covers scripts
A through H and skips the deployed production smoke unless these optional env
vars are supplied:

- `RELEASE_FUN_PRODUCTION_URL`: production or preview base URL to smoke.
- `RELEASE_FUN_EXPECTED_VERSION`: expected `/api/version` value.

When the production vars are set, Script I also verifies `/api/version`, title
screen boot, Quick Race start, and nonblank race canvas paint.

## Script A: First 90 Seconds

Route:
`/quick-race`

Setup:
- Default track: `velvet-coast/harbor-run`.
- Default car and assists.
- Production-sized desktop viewport.

Actions:
1. Start Quick Race.
2. Hold accelerate through the countdown and first 90 seconds.
3. Tap nitro once after phase becomes `racing`.
4. Stay near centerline unless the road clearly asks for a lane change.

Pass criteria:
- A rival or chase target is visible within the first 25 seconds.
- Speed, lap, position, damage, grip, nitro, and cash feedback remain readable.
- The road horizon, hills, lane markings, and edges do not warp or pop.
- Opponent car scale remains plausible while climbing and cresting hills.
- At least one pickup or authored affordance becomes visible.
- Nitro gives immediate speed feedback and visible meter feedback.
- The next action is obvious if the player stops at 90 seconds.

Automation hooks:
- Use `race-visible-ai-count`, `race-visible-pickup-count`,
  `race-player-nitro-active`, `race-collected-pickup-count`, and canvas
  screenshots.
- Add a frame-sampling helper that compares projected opponent sprite size
  against depth and rejects large one-frame jumps on hills.

## Script B: First Full Quick Race

Route:
`/quick-race`

Actions:
1. Start the default Quick Race.
2. Drive to natural finish.
3. Continue from results to garage.

Pass criteria:
- The player sees at least one opponent or chase target.
- The player can spend nitro and collect at least one pickup.
- The finish moment feels different from simply stopping.
- Results show finish placement, cash, bonuses or zero-credit explanation,
  damage, and a clear CTA.
- Continuing from results reaches a useful garage next step.

Automation hooks:
- Extend `e2e/first-race-fun.spec.ts` rather than creating a duplicate.
- Assert `/race/results` and `/garage` routing.
- Keep a visual sample around the finish line.

## Script C: First Tour Chain

Route:
`/world`

Actions:
1. Enter Velvet Coast from the world screen.
2. Complete race one.
3. On results, use the continue-tour CTA to advance to the next race.
4. Continue until the first tour standings change is visible.

Pass criteria:
- The player understands that the tour is a four-race block.
- Current standings, cash, and next-race context are visible during the
  results-to-next-race handoff that exists today.
- The route does not strand the player on a dead-end screen.

Automation hooks:
- Reuse tour-flow coverage and add assertions for standings visibility, repair
  estimate visibility once F-074 lands, and continue-tour CTA text.

## Script D: Upgrade Purchase

Route:
`/garage/upgrade`

Actions:
1. Open upgrade screen after at least one race result.
2. Buy one affordable upgrade or confirm why no upgrade is affordable.
3. Return to race prep.

Pass criteria:
- Current cash and upgrade effect are readable.
- The purchased upgrade is reflected in the save and next race setup.
- If no upgrade is affordable, the game makes the next earning path obvious.

Automation hooks:
- Assert wallet delta, installed tier, and route back to prep or world.

## Script E: Weather Prep

Route:
`/race/prep?track=velvet-coast%2Fharbor-run&tour=velvet-coast&raceIndex=0&weather=rain`

Actions:
1. Open a race with rain, snow, fog, or low visibility.
2. Compare recommended tire and selected tire.
3. Start the race with the recommended tire.

Pass criteria:
- Weather, recommended tire, selected tire, and grip implication are visible.
- In-race HUD reflects weather and grip.
- Visibility effects do not hide hazards unfairly.

Automation hooks:
- Use forecast text, tire selector state, and the resulting `/race` weather
  query until normal race HUD grip telemetry is exposed by F-076.

## Script F: AI Pass

Route:
`/race`

Actions:
1. Start a race with at least two cars.
2. Observe one overtake or defensive movement.
3. Record whether the rival behavior is readable.

Pass criteria:
- An AI car changes lane or pace for a visible reason.
- Passing one car feels achievable.
- Losing or gaining a position updates the HUD clearly.

Automation hooks:
- Use AI visibility count, position changes, and future rival-pressure
  telemetry from F-075.

## Script G: Pickup Collection

Route:
`/race?track=test/straight`

Actions:
1. Start the test straight.
2. Drive through the visible pickup.

Pass criteria:
- Pickup is visible before collection.
- Pickup disappears after collection.
- HUD feedback reports the kind and value.
- SFX route fires when audio is enabled.

Automation hooks:
- Reuse `e2e/race-pickups.spec.ts`.

## Script H: Finish-Line Feel

Route:
`/race`

Actions:
1. Finish a race naturally.
2. Observe finish moment and results transition.

Pass criteria:
- Lap complete and finish are visually distinct.
- Audio event does not mask the engine or other SFX.
- Results route happens once and does not race with restart or retire.

Automation hooks:
- Assert `race-moment`, result URL, and future audio-event telemetry.

## Script I: Deployed Smoke

Route:
Production URL

Actions:
1. Hit `/api/version`.
2. Load title screen.
3. Start a default Quick Race.
4. Confirm race canvas is nonblank.

Pass criteria:
- `/api/version` matches the expected merge commit.
- Production title and Quick Race load.
- Race canvas renders a nonblank frame.

Automation hooks:
- Use existing Vercel production deploy check.
- Add a production Playwright smoke once preview and production URLs are both
  stable in CI.

## Stop Conditions

Do not call the game releasable if any of these occur:

- Main CI or production deploy is red.
- First 90 seconds has no visible opponent or pickup.
- The road or opponent projection visibly warps on hills.
- Results do not make the next step obvious.
- A review thread is unresolved.
- The checklist has not been run on the deployed build for the release commit.

## Automation Backlog

- `VibeGear2-feat-playtest-automate-9d148438`: shipped
  `npm run playtest:release-fun`, covering scripts A through H locally and
  Script I when production env vars are supplied.
- `VibeGear2-feat-playtest-add-4ba02811`: shipped projection and opponent
  readability checks through `e2e/projection-readability.spec.ts`, and the
  release-fun runner now samples road and opponent stability in Script A.
- `VibeGear2-feat-feedback-add-880f1fd2`: add pass and rival-pressure telemetry
  that the AI pass script can assert.
