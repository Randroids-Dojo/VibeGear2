---
title: "fix: mobile touch controls (steer stick unresponsive + ergonomics)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-28T16:10:36.418030-05:00\\\"\""
closed-at: "2026-04-28T16:58:12.798028-05:00"
close-reason: "shipped PR #62, review threads resolved, main CI and production smoke green"
---

Live mobile screenshot shows three issues with the just-mounted TouchControls on /race: (1) the steer thumb-stick does not respond to touch input — drag does not produce steer, so the car can't be steered on mobile at all. Diagnose: pointer event listeners may not be wired (stale registration, target hit-test on the canvas/HUD overlay, e.preventDefault missing), capture order vs. canvas, or pointer-events:none on the wrong layer. (2) Steer stick should be transient and thumb-anchored: invisible by default, appears at the exact (x,y) where the left thumb touches down on the LEFT half of the screen, follows that pointer, and disappears on pointerup — instead of being fixed-position bottom-left. Reference: VibeRacer src/hooks/useTouchControls.ts lines 78-93 (beginJoystick at clientX/clientY; rightHalf split via window.innerWidth/2). (3) GAS and BRK are too high on the right side; they should sit in the natural right-thumb arc near the bottom-right corner so a phone-held grip can reach them without re-gripping. Acceptance: on iPhone Safari portrait /race, tapping anywhere on left half spawns a stick at the touch point that produces non-zero steer when dragged; releasing hides it. GAS/BRK reachable with the right thumb without lifting the grip. Existing /dev/touch e2e (F-017) likely passes — the bug is in the /race mount path, so add a /race-specific Playwright iPhone-13 test that drives a synthetic pointer drag on the left half and asserts steer changes sign.
