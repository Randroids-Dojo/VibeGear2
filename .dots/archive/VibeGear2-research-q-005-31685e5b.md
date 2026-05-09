---
title: "research: Q-005 confirm or revise essential-repair cap fraction per §12 catch-up #2"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T13:03:11.723734-05:00\\\"\""
closed-at: "2026-04-26T15:39:14.465272-05:00"
close-reason: verified
---

blocks: nothing (lever is pinned at 0.40 with easy/normal gate; ships now).

Q-005 (docs/OPEN_QUESTIONS.md): §12 says essential repairs are capped at a low percentage of race income without pinning the percentage. Pinned 0.40 (REPAIR_CAP_FRACTION in src/game/catchUp.ts). Repair cap applies on easy and normal only; hard, master, and extreme always pay full price.

Recommended default in OPEN_QUESTIONS.md: 0.40 with the easy / normal gate. Lands the lever now; balancing pass owns the final number.

Action when answered:
1. If dev keeps the default, mark Q-005 answered with the rationale.
2. If dev wants a different fraction or different difficulty gate, update REPAIR_CAP_FRACTION and/or the gate in src/game/catchUp.ts.

Affected files (when answered):
- docs/OPEN_QUESTIONS.md: Q-005 marked answered.
- docs/gdd/23-balancing-tables.md (optional): pin the fraction.
- src/game/catchUp.ts (only if values change).

Verify:
- npm run test green on the catchUp unit tests after any change.
