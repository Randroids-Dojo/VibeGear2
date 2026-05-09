---
title: "implement: race reward bonuses (podium, fastest lap, clean race, underdog, sponsor objective) per §5 §23"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T03:22:25.473316-05:00\\\"\""
closed-at: "2026-04-26T09:35:22.685906-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-economy-upgrade-ff73b279
  - VibeGear2-implement-race-results-7b0abfaa
---

## Description

Extend the economy module with the bonus-reward system from `docs/gdd/05-core-gameplay-loop.md` Rewards section. Currently `implement-economy-upgrade-ff73b279` ships placement payouts (the `finishMultiplier` table) and tour-bonus payouts; it does not own the §5 bonus list: podium, fastest lap, clean race, underdog finish, tour completion, sponsor objective. This dot is that owner.

## Context

§5 names six reward layers on top of the placement payout. §23 reward formula targets gives base reward per difficulty band. The §7 race-rules engine emits the per-race events that bonuses listen to (podium = top 3; clean race = no contact damage; underdog = finished above grid expectation). The §12 economy module owns the credit accounting; this dot adds the bonus inputs to `awardCredits`.

`implement-race-results-7b0abfaa` consumes the bonus list as the `bonuses[]` field on `RaceResult`. Without this dot the bonus chips render empty.

## Affected Files

- `src/game/raceBonuses.ts` (new): pure functions `computeBonuses(raceState, track, save) => Bonus[]`. One function per bonus type. Bonus shape: `{kind: "podium" | "fastest_lap" | "clean_race" | "underdog" | "tour_complete" | "sponsor", credits: number, label: string}`.
- `src/game/__tests__/raceBonuses.test.ts` (new): cell-level fixtures from §23 plus this dot's pinned multipliers (placement table 0.10/0.05/0.02 of base for podium tiers; fastest lap = 0.08 of base; clean race = 0.05 of base; underdog = +0.10 per grid-rank improvement; tour complete = §12 0.15 of sum).
- `src/game/economy.ts` (update): `awardCredits` accepts a `bonuses: Bonus[]` argument, sums into `credits`, and includes bonuses in the receipt. Backwards-compatible: missing arg defaults to empty array.
- `src/game/raceSession.ts` (update): on `phase === "finished"`, call `computeBonuses` once and stash on the final `RaceState` so the results screen can read them without recomputing.
- `src/data/sponsors.json` (new): sponsor objective catalogue per §5 ("hit X top speed", "finish without nitro", "place top 3 in rain"). Schema in `src/data/schemas.ts` (new `SponsorObjectiveSchema`).
- `src/data/__tests__/sponsors-content.test.ts` (new): every sponsor entry validates; objectives are evaluable from RaceState alone (deterministic).

## Edge Cases

- DNF: no bonuses awarded, including no podium even if the player would have placed.
- Player retires mid-race: same as DNF.
- Fastest lap by AI: bonus not awarded (player-only).
- Clean-race exception: minor rubs (under §23 `rubDamage` floor) do not break clean-race; only `carHit` / `wallHit` / `offRoadObject` events do.
- Tour completion bonus: only on the final race of a tour, only if the tour is passed (per `tour-region-d9ca9a4d` `tourComplete` result).
- Sponsor objective failure: silent; no negative credits.
- Underdog: requires `gridStartingPosition` field from `implement-ai-grid-02d7e311`; gate this bonus on that dot landing or compute against fixed grid-12.

## Verify

- [ ] `computeBonuses` for a fixture: player wins from grid-12, fastest lap, no contact, clean race, no sponsor active. Result lists `[podium-gold, fastest_lap, clean_race, underdog]` with cell-level credits matching pinned multipliers.
- [ ] Podium multipliers: 1st = 0.10 of base, 2nd = 0.05 of base, 3rd = 0.02 of base. Cell-by-cell.
- [ ] Fastest-lap bonus: 0.08 of base, only player-attributed.
- [ ] Clean-race threshold: state with one `rub` event passes; state with one `carHit` fails.
- [ ] Underdog: grid 12 to finish 3 awards `0.10 * (12 - 3) = 0.90` of base; finish equal-or-worse than grid awards 0.
- [ ] Tour-completion bonus only fires on race index 3 of 4 with `tourPassed === true`.
- [ ] Sponsor evaluation: each entry's predicate runs against final RaceState; deterministic.
- [ ] `awardCredits` with bonuses sums correctly; receipt includes a per-bonus breakdown.
- [ ] DNF state returns empty bonus list.
- [ ] Pure: no Math.random, no Date.now.
- [ ] No em-dashes (`grep -rP "[\x{2013}\x{2014}]" src/game/raceBonuses.ts src/data/sponsors.json` returns nothing).
- [ ] PROGRESS_LOG.md entry added.

## References

- `docs/gdd/05-core-gameplay-loop.md` Rewards
- `docs/gdd/12-upgrade-and-economy-system.md` Currency rewards
- `docs/gdd/23-balancing-tables.md` Reward formula targets
- `docs/gdd/07-race-rules-and-structure.md` (placement, DNF, fastest lap)
