---
title: "implement: F-030 provision Vercel KV + swap LEADERBOARD_BACKEND in production per §21"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T13:02:18.453369-05:00\""
closed-at: "2026-04-29T18:33:08.213972-05:00"
close-reason: "Obsoleted by PR #109 because Vercel KV is no longer available for new projects; Q-011 and F-069 now track provider approval and replacement Redis implementation. CI green and production smoke passed at bff1ad5."
---

blocks: none (deploy-side). The feat/leaderboard-client slice ships src/leaderboard/client.ts (gated by NEXT_PUBLIC_LEADERBOARD_ENABLED) and src/leaderboard/store-vercel-kv.ts (loaded dynamically via resolveLeaderboardStore only when LEADERBOARD_BACKEND=vercel-kv). The Vercel KV adapter is a producer waiting on three manual steps that cannot land inside an autonomous slice.

Manual steps (require dev with Vercel project access):
1. vercel kv create leaderboard-prod against the production Vercel project.
2. Link the KV instance which auto-provisions KV_REST_API_URL and KV_REST_API_TOKEN env vars in the Vercel dashboard.
3. npm i @vercel/kv and set LEADERBOARD_BACKEND=vercel-kv plus NEXT_PUBLIC_LEADERBOARD_ENABLED=true in the production env.

Verify:
- Submit one signed lap from the deployed /race flow; read it back via GET /api/leaderboard/test%2Fstraight (URL-encoded slug).
- Latency under 500ms per the §21 budget.
- The bundled MVP default stays disabled until env flips on (per AGENTS.md RULE 7).

Until this lands, the production deploy continues using the noop store and submitLap short-circuits to the disabled sentinel client-side. The KvLike interface in store-vercel-kv.ts is narrow enough that an Upstash Redis swap is a one-line change if KV pricing tier shifts before launch.

Affected files:
- package.json: add @vercel/kv dependency.
- Vercel project settings (out-of-band): KV instance + env vars.
- docs/FOLLOWUPS.md: F-030 marked done with the verification artefact (lap roundtrip).

Note: this dot likely sits parked until a public release window. Priority 3 (nice-to-have) until then.
