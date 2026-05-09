---
title: "research: Q-006 confirm or revise easy-mode tour-clear bonus rate per §12 catch-up #3"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T13:03:18.509710-05:00\""
closed-at: "2026-04-26T15:47:29.089738-05:00"
close-reason: verified
---

blocks: nothing (lever is pinned at 0.20x; easy-mode tour-clear total is 0.15 + 0.20 = 0.35x of summed race rewards).

Q-006 (docs/OPEN_QUESTIONS.md): §12 says easy mode grants bonus cash for tour clears on top of the flat 0.15x §12 tour bonus, but does not pin the bonus rate. Pinned 0.20x of summed race rewards (EASY_MODE_TOUR_BONUS_FRACTION in src/game/catchUp.ts).

Recommended default in OPEN_QUESTIONS.md: 0.20x. Lands the lever now and keeps the balancing-pass slice (VibeGear2-implement-balancing-pass-71a57fd5) responsible for final tuning.

Action when answered:
1. If dev keeps the default, mark Q-006 answered.
2. If dev wants lower (less dependency) or higher (more catch-up runway), update EASY_MODE_TOUR_BONUS_FRACTION in src/game/catchUp.ts.

Affected files (when answered):
- docs/OPEN_QUESTIONS.md: Q-006 marked answered.
- docs/gdd/23-balancing-tables.md (optional): pin the rate.
- src/game/catchUp.ts (only if values change).

Verify:
- npm run test green on the catchUp unit tests after any change.
