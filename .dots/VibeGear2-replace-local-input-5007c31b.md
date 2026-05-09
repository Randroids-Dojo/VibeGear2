---
title: Replace local input.ts/inputTouch.ts joystick math with @randroids-dojo/vibekit virtual-joystick
status: open
priority: 3
issue-type: task
created-at: "2026-05-08T23:29:09.660281-05:00"
---

VibeGear2's inputTouch.ts likely re-implements the joystick state machine that ../VibeKit/src/virtual-joystick.ts exposes. Audit inputTouch.ts: if it is a thin wrapper around the same JoystickState shape, replace its math with VibeKit calls. If it has materially different behavior (e.g. multi-touch, gestures), keep the local module but document why.
