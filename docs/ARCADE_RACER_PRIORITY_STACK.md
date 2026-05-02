# Arcade Racer Priority Stack

Date: 2026-05-02

This document ranks the remaining work that most directly moves VibeGear2 from
MVP to a fun, releasable arcade racer. It is a planning companion to the GDD,
not a replacement for it.

## Source Inputs

- GDD sections 3, 4, 5, 15, 16, 17, 18, and 20.
- `docs/FUN_FACTOR_GAP_AUDIT.md`.
- Top Gear 2 manual and reference material already cited in GDD section 3.
- Current live play observations from the implementation loop.
- External reference refresh:
  - Top Gear 2 manual: https://www.retrogames.cz/manualy/SNES/Top_Gear_2_-_SNES_-_Manual.pdf
  - Sega-16 Top Gear 2 review: https://www.sega-16.com/2011/02/top-gear-2/
  - GameFAQs Top Gear 2 review: https://gamefaqs.gamespot.com/snes/588804-top-gear-2/reviews/167198
  - OpenRetro Top Gear 2 summary: https://openretro.org/snes/top-gear-2

## Ranking Rule

Prioritize the work that produces the largest visible change in the first
race, then the work that makes the next three races feel different, then the
work that upgrades production polish. The game is not releasable until the
default path proves the loop without a player reading docs.

## P0: Race Readability And Trust

Player-visible problem:
The player must believe that opponents, pickups, hills, HUD feedback, and
finish moments obey readable rules. Any projection bug, unclear car scale, or
silent result transition breaks trust.

Already improved:
- Opponent cars render in live races.
- Opponent hill projection now samples fractional segment height.
- On-track cash and nitro pickups are visible and collectible.
- First quick race browser coverage proves the core loop.

Next slices:
- `feat(playtest): automate release-fun checklist`
- Add a production smoke playtest that specifically watches for opponent scale,
  road warp, pickup visibility, result routing, and garage continuation.

Acceptance:
- An agent can run one command and capture evidence that the first race is
  readable from start to garage.
- The evidence must fail if the road projection or opponent car scale regresses.

## P1: Opponents Must Feel Like Competitors

Player-visible problem:
The current AI can race, but the GDD asks for personality. Top Gear 2's traffic
pressure mattered because the player was not just driving a solo time trial.

Next slice:
- `VibeGear2-feat-ai-add-573f4cda`

Required behaviors:
- Rocket starter launches hard and fades later.
- Bully pressures inside lines and defends more often.
- Cautious brakes earlier in poor visibility.
- Chaotic occasionally misses an apex or wastes nitro.
- Enduro runs steady pace with fewer swings.

Acceptance:
- Deterministic unit tests prove each archetype changes target speed,
  lane intent, or mistake profile.
- A browser test or telemetry trace proves at least two behaviors are visible
  during a normal race window.

## P1: First-Tour Tracks Need Authored Decisions

Player-visible problem:
Weather, hills, pickups, and roadside objects exist, but the first tour still
needs memorable track beats. The player should remember a race by an event, not
only by curve direction.

Next slice:
- `VibeGear2-feat-tracks-first-10ebfec0`

Required beats:
- One first-tour track teaches a pickup line.
- One first-tour track teaches a weather or tire consequence.
- One first-tour track teaches traffic plus hazard placement.
- One first-tour track teaches a dramatic hill or crest without projection
  artifacts.

Acceptance:
- Every Velvet Coast track has one named authored beat.
- Content validation checks those beats exist.
- Browser coverage drives at least one full first-tour route with those events.

## P1: Race Audio Must Sell Events

Player-visible problem:
The game has procedural audio, but the mix needs to make major race events
feel intentional. Nitro, impacts, pickup collection, lap completion, and finish
cannot blur together.

Next slice:
- `VibeGear2-feat-audio-race-a656eed2`

Acceptance:
- Nitro, pickup, damage warning, lap, and finish cues remain distinct in the
  SFX runtime tests.
- Race music and event SFX can play together without masking the event cue.
- Options continue to control music and SFX independently.

## P2: Production Car Art Raises The Ceiling

Player-visible problem:
Readable placeholder cars are enough for systems work, but final release needs
distinct silhouettes, damage tiers, and AI identity at race scale.

Next slice:
- `VibeGear2-feat-art-replace-176f701d`

Acceptance:
- Six playable cars have production-quality original sheets.
- Direction, damage, brake, nitro, wet spray, and snow trail variants are
  distinguishable at projected race sizes.
- AI cars have recognizable silhouettes instead of only palette differences.

## P2: Release-Fun Automation Becomes The Gate

Player-visible problem:
The loop needs to stop missing feel regressions. Automated unit and e2e tests
catch correctness, but release fun needs a scripted playtest path that checks
the player experience.

Next slice:
- `VibeGear2-feat-playtest-automate-9d148438`

Acceptance:
- The script or Playwright suite covers first 90 seconds, first full race,
  first tour chain, upgrade purchase, weather prep, AI pass, pickup
  collection, finish moment, and production smoke.
- The output names the build SHA, route, test mode, and any manual evidence
  needed.
- This check becomes part of every future release-readiness loop.

## New Backlog Items

Create implementation dots for gaps not already covered:

- `feat(playtest): add projection and opponent readability checks`
- `feat(tour): make first tour standings pressure visible between races`
- `feat(feedback): add pass and rival-pressure HUD moments`

Created tracking:

- `VibeGear2-feat-playtest-add-4ba02811`, also `F-073`
- `VibeGear2-feat-tour-make-ed6387da`, also `F-074`
- `VibeGear2-feat-feedback-add-880f1fd2`, also `F-075`

## Recommended Next Order

1. Automate release-fun checklist and projection readability checks.
2. Add readable AI archetype behaviors.
3. Add first-tour authored events.
4. Add race mix and event emphasis.
5. Replace placeholder car art.
6. Add first-tour standings pressure if it is not covered by the authored
   event pass.
7. Add pass and rival-pressure HUD moments if AI personality needs stronger
   player feedback.
