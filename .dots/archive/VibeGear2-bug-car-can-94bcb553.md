---
title: "Bug: car can't restart after stopping on grass"
status: closed
priority: 1
issue-type: task
created-at: "\"\\\"2026-04-28T22:21:34.556627-05:00\\\"\""
closed-at: "2026-04-28T22:51:59.782545-05:00"
close-reason: "shipped PR #73, review threads checked, main CI and production smoke green"
---

Repro: drive onto the grass, release the gas, let car come to a full stop. Result: pressing gas does nothing, car is stuck and can't start moving again. Likely a friction/grip threshold or stuck-state issue specific to off-track surfaces.
