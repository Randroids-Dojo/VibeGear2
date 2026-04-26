# 18. Sound and music design

## Music direction

Top Gear 2’s identity is inseparable from its score, and the broader Top Gear series’ music remains one of the most cited reasons fans remember the games at all, even when some players still single out the first game’s soundtrack as the more iconic one. VibeGear2 should therefore treat music as a first-class system, not background dressing—but it must be wholly original in melody, harmony, arrangement, and sound design. [19]

## Music style

Target style:

- upbeat retro-electronic
- bright lead hooks
- punchy bass ostinatos
- syncopated percussion
- dynamic layers based on race intensity
- regional instrumentation colors without pastiche

## Menu music

- Warm, inviting, slightly slower
- Establishes identity
- Must loop cleanly for long garage sessions

## Race music

- One theme per tour
- 2 to 3 intensity layers
- Final-lap escalation sting optional
- Time-trial mix can be cleaner and less dense

## Region themes

Each region theme should have:

- base groove
- motif
- instrumentation accent
- weather stem option

## Vehicle and race SFX

VibeRacer already uses a procedural Web Audio approach with a shared AudioContext, scheduled music, an engine drone, skid noise, PB fanfares, off-track rumble, and UI clicks. That is a strong base to reuse conceptually for VibeGear2, even if the sound palette changes. [20]

Required sounds:

- engine idle / low / mid / high
- nitro engage
- gear shift
- brake scrub
- tire squeal
- wall hit
- car rub
- spray / snow hush
- countdown
- lap complete
- results stinger

## Dynamic audio layers

- Speed raises engine harmonic content
- Nitro adds filtered high layer
- Off-road adds rumble and debris band
- Weather adds ambient pad or noise layer
- Menu-to-race crossfades should be smooth

## Open-source-friendly audio guidance

- All music stems and SFX source files should have clear licenses.
- Prefer contributor-created stems or CC0/CC BY material with attribution tracking.
- Never include “temporary homage” music in the repo.
