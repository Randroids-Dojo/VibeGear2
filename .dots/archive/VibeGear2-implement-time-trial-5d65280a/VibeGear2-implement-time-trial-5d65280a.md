---
title: "implement: time trial + daily challenge modes per §6"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:42.595832-05:00\\\"\""
closed-at: "2026-04-30T09:17:41.840108-05:00"
close-reason: §6 Time Trial and Daily Challenge slices complete. PB persistence, benchmark launch, downloaded ghosts, result sharing, and UTC fake-clock e2e are merged and production-smoked through 2ee0e56.
blocks:
  - VibeGear2-implement-race-rules-b30656ae
---

## Description

Implement Time Trial and Daily Challenge modes per `docs/gdd/06-game-modes.md`. Time Trial: solo race with no AI, target lap times, personal best tracking. Daily Challenge: deterministic seed per UTC day, fixed track + weather, share-to-clipboard result.

## Context

Phase 5 task per `docs/IMPLEMENTATION_PLAN.md`. Time Trial is a stepping stone toward ghost replay (separate dot).

## Affected Files

- `src/game/modes/timeTrial.ts` (new)
- `src/game/modes/dailyChallenge.ts` (new): seeded selection by UTC day
- `src/app/time-trial/page.tsx` (new)
- `src/app/daily/page.tsx` (new)
- `src/game/__tests__/dailyChallenge.test.ts` (new): same UTC day produces same seed
- `e2e/time-trial.spec.ts` (new)

## Edge Cases

- Daily Challenge crossing UTC midnight mid-run: do not change seed mid-run.
- No personal best yet: show "no record" placeholder.
- Local time zone offsets: seed always derived from UTC.

## Verify

- [ ] Daily seed determinism: `dailySeed(new Date('2026-04-26T03:00:00Z'))` equals `dailySeed(new Date('2026-04-26T22:00:00Z'))` and differs from `dailySeed(new Date('2026-04-27T01:00:00Z'))`. Unit test covers 30 sequential UTC days.
- [ ] Daily-seed-derived selection: same seed returns the same `(trackId, weather, carClass)` tuple deterministically across 1000 invocations.
- [ ] Time-trial PB persistence: a fixture run with scripted inputs finishing a 1-lap race writes `records[trackId].bestLapMs` only if the new lap is faster than the prior PB. Reload; PB is still there.
- [ ] No PB yet: HUD shows the literal string "no record" (RTL test).
- [ ] Playwright e2e (`e2e/time-trial.spec.ts`): load `/time-trial?track=test-straight`, hold ArrowUp for 5 s to finish a lap, assert results overlay shows `MM:SS.mmm` time and the "save as PB" button writes to localStorage.
- [ ] Daily Challenge share-to-clipboard: clicking "Share" calls `navigator.clipboard.writeText` with a string matching the regex `/VibeGear2 Daily \d{4}-\d{2}-\d{2} \d+:\d{2}\.\d{3}/` (Playwright with `clipboard-read` permission); also offers a fallback "Copy" textarea for browsers without the clipboard API.
- [ ] UTC-midnight crossing mid-run: Playwright with a fake clock advancing past midnight; the seed in use stays the seed from the run's start.
- [ ] No em-dashes in any added file (`grep -rP "[–—]" src/game/modes src/app/time-trial src/app/daily e2e/time-trial.spec.ts` returns nothing).
- [ ] PROGRESS_LOG.md entry added per §6.
