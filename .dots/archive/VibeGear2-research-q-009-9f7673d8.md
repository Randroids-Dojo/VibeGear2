---
title: "research: Q-009 cross-tab save protocol leader-tab vs last-write-wins per §21 §27"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T13:03:43.497977-05:00\""
closed-at: "2026-04-26T14:50:52.089391-05:00"
close-reason: verified
---

blocks: nothing (last-write-wins shipped via feat/cross-tab-save-consistency).

Q-009 (docs/OPEN_QUESTIONS.md): the cross-tab slice (VibeGear2-implement-cross-tab-fa8cb14c) shipped a last-write-wins protocol with a monotonic writeCounter advisory plus subscribeToSaveChanges and reloadIfNewer. Should we upgrade?

Options:
(a) Keep last-write-wins (recommended). Simplest. Works in every supported browser without BroadcastChannel. Data is local-only in the MVP. The writeCounter advisory + focus revalidate cover the 'free upgrade by stale tab' failure case.
(b) Leader-tab election via BroadcastChannel. Adds complexity (handoff, election, two-leader resolution). Buys deterministic write ordering.
(c) Defer to cloud sync. Cross-tab gets resolved for free once writes go through a server. Risk: cloud sync may not ship for months.

Recommended default in OPEN_QUESTIONS.md: (a). Keep last-write-wins until either §27 gains a higher-priority cross-tab risk or cloud sync starts landing and we can switch to (c) directly.

Action when answered:
1. If dev confirms (a), mark Q-009 answered.
2. If dev picks (b), implement leader-tab election; if (c), defer until cloud sync work.

Affected files (when answered):
- docs/OPEN_QUESTIONS.md: Q-009 marked answered.
- src/game/save.ts + cross-tab module (only if upgrading).

Verify:
- npm run test green on save / cross-tab unit tests after any change.
