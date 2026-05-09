---
title: "implement: optional online leaderboard endpoint (POST/GET stubs + signed lap submission) per §21 §24"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"\\\\\\\"\\\\\\\\\\\\\\\"2026-04-26T02:21:06.160171-05:00\\\\\\\\\\\\\\\"\\\\\\\"\\\"\""
closed-at: "2026-04-26T08:13:54.471601-05:00"
close-reason: released claim, sub-slice landed (pure primitives); route handlers + KV adapter + client adapter remain on follow-up dots
blocks:
  - VibeGear2-implement-race-rules-b30656ae
  - VibeGear2-implement-seeded-deterministic-2ae383f2
---

## Description

Ship the optional online leaderboard endpoint described in `docs/gdd/21-technical-design-for-web-implementation.md` ("signed lap submission concept", "leaderboard back end concept") and called for in `docs/gdd/24-content-plan.md` v1.0 ("Online leaderboard"). Two API routes plus a client adapter:

- `POST /api/leaderboard/submit` accepts a signed lap submission; verifies the race-token signature; rejects out-of-band lap times; writes to the configured backing store. 
- `GET /api/leaderboard/[trackId]` returns the top-N times for a track.
- A client adapter in `src/leaderboard/client.ts` handles fetch + retry; respects a feature flag so the endpoint can be disabled per-build (private deploy, single-player mode).

Backing store is pluggable behind an interface so the project can ship a no-op store on Vercel free tier today, swap to Upstash Redis or Vercel KV later (matching VibeRacer's pattern per §21).

## Context

§21 calls out "local saves, optional leaderboard/ghost backend" as a Persistence layer concern; §24 v1.0 lists "Online leaderboard". §25 vertical-slice phase lists "one leaderboard endpoint" as a deliverable. Currently no dot owns the leaderboard endpoint or the submission path. The `implement-ghost-replay-7ea6ffaa` dot covers ghost playback locally; this dot is its server-side counterpart.

Depends on `implement-race-rules-b30656ae` (the lap timing source of truth), `implement-seeded-deterministic-2ae383f2` (deterministic race => signable result), and the deploy slice (the API routes need a runtime). Blocks the §24 v1.0 content goal.

Privacy posture: opt-in submission, no PII collected, the player can clear their submitted scores. Matches `docs/WORKING_AGREEMENT.md` §11 (no telemetry by default).

## Affected Files

- `src/leaderboard/types.ts` (new): `LapSubmission`, `LeaderboardEntry`, `LeaderboardStore` interface.
- `src/leaderboard/sign.ts` (new): pure HMAC-SHA-256 signing of the canonical submission tuple. Server signs + sends a race-token at race start; client returns the token signed alongside the lap result.
- `src/leaderboard/store-noop.ts` (new): the default store. `submit()` succeeds + returns null id; `top()` returns []. Used when `process.env.LEADERBOARD_BACKEND === 'noop'` or unset.
- `src/leaderboard/store-vercel-kv.ts` (new, optional, skipped in tests): a Vercel KV implementation behind `process.env.LEADERBOARD_BACKEND === 'vercel-kv'`. Loaded dynamically so the bundle stays slim when KV is not configured.
- `src/app/api/leaderboard/submit/route.ts` (new): POST handler.
- `src/app/api/leaderboard/[trackId]/route.ts` (new): GET handler.
- `src/leaderboard/client.ts` (new): `submitLap(token, lap)`, `getTop(trackId, n)`. Respects `process.env.NEXT_PUBLIC_LEADERBOARD_ENABLED`.
- `src/leaderboard/__tests__/sign.test.ts` (new): canonicalization is stable; signed tuples verify; tampered tuples fail.
- `src/leaderboard/__tests__/store-noop.test.ts` (new): contract test that the LeaderboardStore interface is satisfied.
- `e2e/leaderboard.spec.ts` (new, optional): when LEADERBOARD_BACKEND=noop, submit returns OK and GET returns []; when vercel-kv is mocked, submit + read round-trip a lap time.

## Edge Cases

- Submission with a corrupt or missing race-token signature: 401, no store write.
- Submission with a lap time below the track's physically-possible minimum (computed from track length / topSpeed): 422.
- Submission for a track that does not exist in `src/data/tracks/`: 404.
- Two submissions with the same (carId, trackId, lapMs): the second is rejected as duplicate, not overwritten.
- LEADERBOARD_BACKEND unset: client surface is no-op; UI shows "Local times only" instead of the leaderboard list.
- Player clears their submitted scores: client deletes the local cached entries; the server-side rows remain unless an explicit DELETE endpoint is added (out of scope for this slice; tracked as a followup if KV lands).

## Verify

- [ ] Sign / verify round-trip is deterministic and rejects every tampered field individually (Vitest covers carId, trackId, lapMs, raceToken).
- [ ] Noop store passes the contract test.
- [ ] `/api/leaderboard/submit` returns 401 / 422 / 404 / 200 for the documented cases (Vitest with a fake Request).
- [ ] `/api/leaderboard/[trackId]` returns the configured store's `top()` output.
- [ ] Client adapter respects the feature flag: when off, every method resolves to a documented sentinel without hitting the network.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.
- [ ] FOLLOWUPS.md entry: provision Vercel KV and swap LEADERBOARD_BACKEND in production (manual, post-merge).

## References

- `docs/gdd/21-technical-design-for-web-implementation.md` (signed lap submission, leaderboard back end concept)
- `docs/gdd/24-content-plan.md` (v1.0 Online leaderboard)
- `docs/gdd/25-development-roadmap.md` (Vertical Slice phase)
- VibeRacer reference: signed race tokens + Upstash-backed keys [§21 references 23, 24]
