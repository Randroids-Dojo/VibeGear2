---
title: "implement: manual transmission race-session wiring (PlayerCarState.transmission, input.shiftUp/shiftDown consumption, physics gear curve) per §10 §19"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T05:35:07.512346-05:00\\\"\""
closed-at: "2026-04-26T06:25:36.595262-05:00"
close-reason: verified
---

src/game/transmission.ts is implemented but unwired. Add TransmissionState to PlayerCarState in src/game/raceState.ts, init via createTransmissionForCar reading SaveGameSettings.transmissionMode + gearbox upgrade tier, advance via tickTransmission each tick consuming input.shiftUp/shiftDown edges, and pipe gearAccelMultiplier into physics step accelMultiplier (composing with nitro multiplier). Toggle E/Q ignored when mode=auto. No em-dashes. Tests: per-car transmission init; manual shift edges fire on rising input edge only; auto mode ignores shift inputs; deterministic 1000-tick replay.
