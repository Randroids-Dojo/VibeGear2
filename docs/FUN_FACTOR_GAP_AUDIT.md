# Fun Factor Gap Audit

Date: 2026-05-01

This audit compares the current VibeGear2 loop against the fun pillars in the
GDD and the Top Gear 2 reference material. It is a backlog-shaping document,
not a replacement for the GDD.

## Reference Findings

Top Gear 2 worked because it stacked arcade immediacy with medium-term pressure:
opponents on screen, weather preparation, upgrade choices, damage pressure, and
short tour blocks. The SNES manual anchors the tour structure, points economy,
controls, weather prep, and password progression. The existing GDD already
captures those lessons in sections 3, 4, 5, 12, 14, 15, 18, 20, and 25.

The strongest external confirmation is that later reviews keep naming the same
clusters: roughly 64 tracks across 16 countries, cash rewards feeding tires,
engine, gearbox, armor, and nitro upgrades, weather and visibility changes,
track obstacles, jumps, pickups, and CPU cars that create traffic instead of
empty time trials. Sega-16 also calls out weak points we should avoid: cheap
AI handoffs, unfair obstacle rules, repetition, and audio compromise between
music and effects.

Sources:
- Top Gear 2 SNES manual: https://www.retrogames.cz/manualy/SNES/Top_Gear_2_-_SNES_-_Manual.pdf
- Existing VibeGear2 GDD section 3: `docs/gdd/03-top-gear-2-research-summary.md`
- Sega-16 review: https://www.sega-16.com/2011/02/top-gear-2/
- GameFAQs SNES FAQ: https://gamefaqs.gamespot.com/snes/588804-top-gear-2/faqs/7418
- GameFAQs review: https://gamefaqs.gamespot.com/snes/588804-top-gear-2/reviews/167198

## Current Gap Ranking

### P0: The race must feel like a race

Status: improved by PR #145, but not finished.

What is already present:
- AI cars now render in live `/race`.
- AI overtake intent has visible lateral movement.
- Race results, damage persistence, upgrades, repairs, tire prep, weather
  rendering, and leaderboards are wired.

Remaining work:
- AI archetypes need readable personalities.
- AI must use nitro and weather skill visibly.
- Finish-line feedback needs a stronger win, pass, and lap-complete moment.
- Pickups need to make the racing line more tactical.

Implementation dots:
- `VibeGear2-feat-ai-add-573f4cda`
- `VibeGear2-feat-race-finish-e3275ad7`
- `VibeGear2-feat-pickups-on-9f6438bd`

### P1: The first 90 seconds must sell the loop

Problem: the game has many systems, but a new player should understand the
promise before they read a menu. Within one race they should see a rival,
spend nitro, collect or miss something, make a visible mistake, finish, earn
cash, and see why the next garage choice matters.

Implementation dots to add:
- `feat(tuning): first-race fun pass`
- `feat(playtest): release-fun checklist automation`

Acceptance shape:
- Browser test drives the default quick race for 90 seconds.
- Test or trace confirms visible opponent, nitro use, at least one high-value
  affordance such as pickup or finish event, and a route from results to garage.
- Human playtest script records whether the next action is obvious.

### P1: Track texture needs tactical objects, not just scenery

Problem: weather, roadside art, parallax, and tunnels exist, but Top Gear 2's
extra spice came from pickups, jumps, obstacles, and road furniture that made
each track feel authored.

Existing dot:
- `VibeGear2-feat-pickups-on-9f6438bd`

Follow-on candidate:
- `feat(tracks): first-tour authored event pass`

Acceptance shape:
- Each Velvet Coast race has one memorable non-curve feature.
- Features affect player decisions without violating readability.
- AI and player obey the same visible rule unless the GDD explicitly says not
  to.

### P1: Production art must replace placeholder feel

Existing dot:
- `VibeGear2-feat-art-replace-176f701d`

Acceptance shape:
- All six playable cars have production-grade readable silhouettes.
- Damage tiers and directional frames remain distinct at race scale.
- AI cars use distinct looks, not just tint fallbacks.

### P2: Audio must keep momentum without legal risk

Current state: original race music and SFX exist, but the launch bar is higher
than "sound plays." The mix needs to make nitro, passing, lap completion,
finish, collisions, weather, and UI confirmation readable together.

Implementation dot to add:
- `feat(audio): race mix and event emphasis pass`

Acceptance shape:
- Race music and SFX play together.
- Nitro, finish, collision, damage warning, and countdown are clearly audible.
- Weather ambience supports mood without masking engine and event cues.

## Ordered Loop Recommendation

1. Finish-line moment and lap rollover polish.
2. On-track pickups.
3. Readable AI archetype behavior.
4. First-race fun tuning pass.
5. Race mix and event emphasis pass.
6. Production car art pass.
7. First-tour authored event pass.
8. Release-fun checklist automation.

This order moves the live race from functional to fun before spending large
time on content and art scale-out.

## Agent Checklist Before Calling A Race Slice Done

- Does the player see at least one opponent or chase target?
- Does one button create a satisfying acceleration or recovery moment?
- Does the road ahead read clearly at speed?
- Does the track ask for at least one decision beyond steering?
- Does finishing give feedback that feels different from simply stopping?
- Does the result screen make the next garage or tour action obvious?
- Did CI, browser e2e, PR comments, main deploy, and production smoke pass?
