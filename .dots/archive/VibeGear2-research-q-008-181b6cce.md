---
title: "research: Q-008 tire modifiers for §23-uncovered weathers light_rain/dusk/night per §14 §23"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T14:16:45.120405-05:00\""
closed-at: "2026-04-28T08:51:51.690748-05:00"
close-reason: Q-008 is answered in docs/OPEN_QUESTIONS.md and implemented through weather tire modifier aliases including overcast.
---

blocks: weather + environmental systems slice (VibeGear2-implement-weather-38d61fc2).

Q-008 (docs/OPEN_QUESTIONS.md): WeatherOption enum declares 8 values (clear, light_rain, rain, heavy_rain, fog, snow, dusk, night) but §23 'Weather modifiers' only specifies 5 (Clear, Rain, Heavy rain, Snow, Fog). When a track JSON authors weatherOptions: ['light_rain'] and a runtime physics consumer asks getWeatherTireModifier('light_rain'), what should the lookup return?

Options:
(a) Pin to identity: { dryTireMod: 0, wetTireMod: 0 } for every uncovered weather. Cheapest; silently ignores authoring intent.
(b) Alias to nearest §23 row: light_rain -> rain, dusk -> clear, night -> clear (or fog for visibility bias). Requires picking the alias map up-front.
(c) Reject in schema: drop light_rain/dusk/night from WeatherOptionSchema. Breaks existing track JSON fixtures that already author them.
(d) Extend §23 to cover all eight. GDD edit; parent weather dot owns this decision.

Recommended default in OPEN_QUESTIONS.md: option (a) for the wiring slice in the parent dot, paired with a §14 doc note that the three uncovered weathers are 'visibility variants' rather than 'grip variants' and a follow-up content lint that warns when a track lists an uncovered weather without also listing a §23 row to fall back to. Option (d) is the right long-term answer; option (a) ships the parent dot without blocking on a GDD edit.

Action when answered:
1. If dev confirms (a), mark Q-008 answered and ensure getWeatherTireModifier returns identity for the three uncovered weathers when the weather slice consumes the lookup.
2. If dev picks (b), thread the alias map into the weather module and unit-test each alias.
3. If dev picks (c), drop the three values from WeatherOptionSchema and migrate any existing fixtures.
4. If dev picks (d), draft the §23 GDD edit and re-derive the table.

Affected files (when answered):
- docs/OPEN_QUESTIONS.md: Q-008 marked answered.
- src/game/weather.ts (consumer; only if surface changes).
- src/data/schemas.ts (only if option (c)).
- docs/gdd/23-balancing-tables.md (only if option (d)).

Verify:
- npm run test green on the weather + schema unit tests after any change.
- No em-dashes in changed files.
