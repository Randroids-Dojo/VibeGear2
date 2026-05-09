---
title: "research: Q-004 confirm or revise tour stipend threshold + amount per §12 catch-up #1"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T13:03:06.364797-05:00\""
closed-at: "2026-04-26T15:32:54.004906-05:00"
close-reason: verified
---

blocks: F-035 ships against pinned defaults already (STIPEND_THRESHOLD_CREDITS=1500, STIPEND_AMOUNT=1000 in src/game/catchUp.ts) so no consumer is blocked.

Q-004 (docs/OPEN_QUESTIONS.md): §12 says players below a cash threshold receive a tour stipend without pinning the threshold or grant amount. Pinned defaults plus first-tour gate (no stipend on tour 1) and one-claim-per-tour invariant are encoded in computeStipend.

Recommended default in OPEN_QUESTIONS.md: keep 1500 / 1000 with the first-tour gate. The threshold buys roughly two tier-1 cooling upgrades; the amount matches a mid-table finish at base 2000 / normal so the lever is a catch-up not a free win.

Action when answered:
1. If dev keeps the defaults, mark Q-004 answered with the rationale stub and note the values in §23.
2. If dev wants different numbers or a different gate, update STIPEND_THRESHOLD_CREDITS / STIPEND_AMOUNT / the first-tour gate in src/game/catchUp.ts and re-run unit tests.

Affected files (when answered):
- docs/OPEN_QUESTIONS.md: Q-004 marked answered.
- docs/gdd/23-balancing-tables.md (optional): pin the table row.
- src/game/catchUp.ts (only if values change).

Verify:
- npm run test green on the catchUp unit tests after any value change.
