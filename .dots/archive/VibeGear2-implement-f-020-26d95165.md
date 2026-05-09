---
title: "implement: F-020 scripts/content-lint.ts to enforce LEGAL_SAFETY denylist per §26"
status: closed
priority: 2
issue-type: task
created-at: "\"\\\"2026-04-26T13:01:20.061416-05:00\\\"\""
closed-at: "2026-04-26T13:15:14.674428-05:00"
close-reason: verified
---

blocks: none. F-020 in docs/FOLLOWUPS.md (status: open). docs/LEGAL_SAFETY.md §9 sets the contract.

Create scripts/content-lint.ts that runs as part of npm run verify and fails the build on:
(a) any binary in public/ missing an asset manifest entry,
(b) track JSON referencing a real-circuit name from a denylist (Nurburgring, Spa, Suzuka, Monza, Silverstone, Imola, Estoril, Le Mans, Monaco, Daytona, Indianapolis),
(c) car names matching a manufacturer denylist (Skyline, Mustang, Civic, Camaro, Supra, Lancer),
(d) text content matching the Top Gear denylist (Top Gear, topgear, Kemco, Snowblind).

The denylists live authoritatively in the script when it lands; the doc text is illustrative.

Affected files:
- scripts/content-lint.ts (new): the lint, exits non-zero on any hit.
- scripts/__tests__/content-lint.test.ts (new): positive and negative cases per category.
- package.json: wire content-lint into npm run verify.
- docs/FOLLOWUPS.md: F-020 marked done.

Verify:
- npm run verify clean on a clean tree.
- A synthetic track JSON with a denylisted name fails verify.
- An asset under public/ with no manifest entry fails verify.
- No em-dashes or en-dashes in changed files.
