---
title: "research: Q-007 practice mode weather preview surface per §12 §6"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T13:03:29.169039-05:00\""
closed-at: "2026-04-26T15:11:04.785113-05:00"
close-reason: verified
---

blocks: practice + quick-race modes slice (VibeGear2-implement-practice-quick-ad3ba399).

Q-007 (docs/OPEN_QUESTIONS.md): §12 says practice mode can preview track weather so bad setup choices feel fair, not hidden. The catch-up module currently returns the track's full weatherOptions array verbatim (practiceWeatherPreview).

Options:
(a) Keep deterministic 'all options' preview (recommended default; ships now).
(b) Preview the actual seeded roll for the upcoming session (leaks the seed to the UI, complicates §21 deterministic-replay invariants).
(c) Preview a probability-weighted sample (needs a probability table §12 does not pin).

Recommended default in OPEN_QUESTIONS.md: option (a). Smallest spec; the practice-mode slice may revisit.

Action when answered:
1. If dev confirms (a), mark Q-007 answered.
2. If dev picks (b) or (c), thread the chosen surface into practiceWeatherPreview in src/game/catchUp.ts and the practice-mode UI.

Affected files (when answered):
- docs/OPEN_QUESTIONS.md: Q-007 marked answered.
- src/game/catchUp.ts (only if surface changes).
- practice-mode page (when slice lands).

Verify:
- npm run test green on the catchUp unit tests after any change.
