---
title: mount existing TouchControls on /race route (F-013 follow-up)
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-28T00:32:58.302083-05:00\\\"\""
closed-at: "2026-04-28T01:51:36.333801-05:00"
close-reason: "Merged PR #38. Live race route mounts TouchControls and routes touch input through the canvas input manager."
---

F-013 shipped createTouchInputSource + TouchControls.tsx (gated on pointer:coarse) and F-017 covers them via e2e on /dev/touch — but the live /race route does NOT mount them, per FOLLOWUPS note ('Race route does not yet mount touch controls'). Wire TouchControls into the race page's input merge so mobile users can actually steer/throttle/brake/pause. Pair with the mobile-viewport-sizing dot since both block mobile playability. Acceptance: on iPhone 13 emulation in Playwright, /race shows the touch overlay, dragging the steer stick produces non-zero steer input in the loop, and tapping GAS/BRK/pause zones works. Reference impl pattern in VibeRacer src/components/TouchControls.tsx + src/hooks/useTouchControls.ts.
