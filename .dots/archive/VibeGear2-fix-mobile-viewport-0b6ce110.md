---
title: "fix: mobile viewport sizing on /race (canvas should fill screen)"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-28T00:32:51.712281-05:00\\\"\""
closed-at: "2026-04-28T01:51:36.330627-05:00"
close-reason: "Merged PR #38. Race canvas now fills mobile viewport with no page scroll and production smoke passed."
---

On mobile portrait, /race renders the canvas as a small box at the top of the page (large empty black area below). Replicate VibeRacer's approach (verified at /Users/randroid/Documents/Dev/VibeRacer): root container with position:fixed, inset:0, overflow:hidden, touch-action:none, user-select:none; canvas styled width:100%/height:100%/display:block; on mount + window 'resize' event call a resize() that reads clientWidth/clientHeight and resizes the canvas backing store with DPR clamp Math.min(window.devicePixelRatio, 2). Avoid 100vh/100dvh — the fixed+inset+overflow:hidden combo sidesteps the iOS Safari address-bar dynamic-viewport problem. Touch goal: canvas fills viewport edge-to-edge in portrait and landscape on iPhone Safari, Android Chrome, and desktop. Acceptance: visual smoke at /race on iPhone 13 emulation (e2e Playwright) shows canvas height ≥ window.innerHeight - HUD-bar height; no scrollable body.
