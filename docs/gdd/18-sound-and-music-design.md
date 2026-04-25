# 18. Sound and Music Design

## Music Style

The music should be original and high-energy. It may be inspired by broad genres:

- Synthwave
- Breakbeat
- Chiptune-inspired leads
- Arcade rock
- Electro-funk
- Drum and bass-lite
- FM synth textures
- Modern retro racing themes

It must not copy melodies, basslines, samples, arrangements, or sound design from commercial racing games.

## Menu Music

| Screen | Music Direction |
|---|---|
| Title | Bold theme, 120-140 BPM, memorable hook. |
| Tour map | Short looping groove, less intense. |
| Garage | Mechanical synth pulse, calm but rhythmic. |
| Results | Short stingers plus ambient loop. |
| Track editor | Minimal beat, focus-friendly. |

## Race Music

| Region | Music Direction |
|---|---|
| Neon Harbor | Bright synth bass, gated drums. |
| Redwood Circuit | Breakbeat with airy pads. |
| Mirage Basin | Percussive electro, dry leads. |
| Storm Coast | Dark arps, heavier kick, rain ambience. |
| Alpine Static | Cold FM bells, tight snare, pulsing bass. |
| Glass Canyon | Rock-synth hybrid, echo leads. |
| Metro Midnight | Fast arcade club track. |
| Aurora Highway | Expansive synth anthem. |

## Dynamic Audio Layers

| Layer | Trigger |
|---|---|
| Base loop | Always during race. |
| Final lap layer | Last lap begins. |
| Boost accent | Pulse Boost activated. |
| Low damage warning | Damage above 70 percent. |
| Rival pressure layer | Rival within 2 positions. |
| Finish stinger | Race ends. |
| Menu return sting | Return to garage or tour. |

## Engine Sounds

Implementation options:

| Option | MVP Suitability |
|---|---|
| Web Audio oscillator engine | High |
| Sample-based engine loops | Medium |
| Hybrid oscillator plus samples | High for v1.0 |

Engine audio should respond to RPM, gear, speed, throttle, damage, boost, and surface.

## Tire Squeal

Rules:

- Trigger based on slip, not any turn.
- Duck volume when music lead is active.
- Provide separate tire volume slider.
- Use varied samples or pitch modulation.
- Avoid constant annoying squeal.

## Collision Sounds

| Collision | Sound |
|---|---|
| Light rub | Plastic scrape. |
| Side hit | Short metal bump. |
| Barrier | Heavy crunch plus sparks. |
| Hazard | Object-specific hit. |
| Critical damage | Low warning alarm. |

## Weather Ambience

| Weather | Sound |
|---|---|
| Light rain | Soft rain bed. |
| Heavy rain | Louder rain, spray, distant thunder. |
| Snow | Muffled wind. |
| Dust | Dry wind gusts. |
| Night | Low ambience, city hum depending region. |
| Storm | Thunder, but no sudden painful peaks. |

## Countdown, Start, and Finish Stingers

| Event | Sound |
|---|---|
| Countdown 3-2-1 | Three pitched beeps. |
| Start | Bright launch tone. |
| Lap complete | Short tick or chime. |
| Final lap | Distinct musical sting. |
| Finish | Placement-based sting. |
| New upgrade affordable | Subtle garage notification. |

## Open-Source-Friendly Asset Guidance

| Asset Type | Preferred License |
|---|---|
| Original music | CC BY 4.0, CC0, or custom permissive license. |
| SFX | CC0 or CC BY 4.0. |
| Fonts | SIL OFL or compatible. |
| Samples | Must be cleared for games and redistribution. |
| Procedural audio | Preferred for MVP to reduce asset burden. |
