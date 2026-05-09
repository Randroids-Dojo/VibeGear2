---
title: "implement: economy + upgrade system per §12"
status: closed
priority: 3
issue-type: task
created-at: "\"\\\"2026-04-26T00:57:05.696120-05:00\\\"\""
closed-at: "2026-04-26T08:49:05.506942-05:00"
close-reason: verified
blocks:
  - VibeGear2-implement-race-rules-b30656ae
---

## Description

Build `src/game/economy.ts`. Implement: credits earned per placement, repair cost deductions, upgrade purchase, and the per-car upgrade slot rules with caps from each car's `upgradeCaps`. Pure functions on `SaveGame` state.

## Context

Phase 2 task per `docs/IMPLEMENTATION_PLAN.md`. Source of truth: `docs/gdd/12-upgrade-and-economy-system.md` and the schema in `docs/gdd/22-data-schemas.md` (upgrade caps under each car). Numeric values come from `docs/gdd/23-balancing-tables.md`.

## Affected Files

- `src/game/economy.ts` (new): `awardCredits`, `applyRepairCost`, `purchaseUpgrade`, `installUpgrade` (pure)
- `src/game/__tests__/economy.test.ts` (new): purchase rejected when insufficient credits, when at cap, etc.
- `src/data/upgrades.json` (new): upgrade catalogue conforming to §22

## Edge Cases

- Insufficient credits: function returns failure result; no state mutation.
- Already at upgrade cap: rejected.
- Buying tier 3 without owning tier 2: rejected (sequential install).
- Selling: out of scope unless GDD §12 specifies it.

## Verify

- [ ] Unit tests cover purchase, install, repair, all rejection paths.
- [ ] Pure: no I/O, no side effects.
- [ ] Determinism: same input state and action returns identical output state.
- [ ] No em-dashes in any added file.
- [ ] PROGRESS_LOG.md entry added per §6.

## Researcher Stress-Test (iter-19)

The 38-line spec under-specifies the result shape, the upgrade catalogue, and the failure-mode taxonomy. Four blockers and six pins.

### 1. The `Result<T, E>` pattern is missing.

Spec says "function returns failure result; no state mutation" but does not define the shape. Pin a discriminated union so callers (UI, tests) can branch on the failure code:

```ts
export type EconomyResult<S, F = EconomyFailure> =
  | { ok: true; state: S; receipt: EconomyReceipt }
  | { ok: false; failure: F };

export type EconomyFailure =
  | { code: "insufficient_credits"; required: number; available: number }
  | { code: "upgrade_not_owned"; upgradeId: string }
  | { code: "upgrade_at_cap"; category: UpgradeCategory; cap: number }
  | { code: "tier_skip"; category: UpgradeCategory; required: number; attempted: number }
  | { code: "no_damage"; zone: DamageZone }
  | { code: "unknown_car"; carId: string };

export interface EconomyReceipt {
  kind: "purchase" | "install" | "repair" | "award";
  amountCredits: number;          // negative for spend, positive for award
  description: string;
  ledgerTimestampMs: number;      // pinned by caller; pure
}
```

The receipt feeds the §20 "Cash earned" and "Repair spend" rows on the results screen and the §7 "lowest total repair spend" tour-tie-break rule. Without it, the standings tie-break in §7 cannot be implemented.

### 2. Upgrade catalogue shape: pin the JSON.

`src/data/upgrades.json` is mentioned but no example is given. Schema already exists at `src/data/schemas.ts:187` (UpgradeSchema). The JSON must enumerate every (category, tier) cell from §12 "Example upgrade table" plus the §12 "Upgrade levels" Stock=tier 0 invariant:

- 8 categories x 4 paid tiers = 32 entries; ids of the form `engine-street`, `engine-sport`, `engine-factory`, `engine-extreme`, `gearbox-street`, etc.
- Stock (tier 0) is implicit; not in the JSON. `installedUpgrades` defaults to 0 per category, schema-permitted.
- Each entry's `cost` cell-by-cell from §12 example table (e.g. `engine-street.cost === 3000`).
- `effects` map: pin **at least one effect per category** so UpgradeEffectsSchema's `.refine` does not fail. Numeric values: defer to balancing-pass-71a57fd5; this dot ships placeholder values flagged with `// PLACEHOLDER, replace in balancing-pass`. Coordinate by adding a `// see balancing-pass` comment at the top of `src/data/upgrades.json`.

The "Stock -> Street -> Sport -> Factory -> Extreme" sequence in §12 means tiers 1..4 in the JSON. Confirm the JSON tier values match the schema's `tier: 1..10` (they will); the cap object in `Car.upgradeCaps` must allow up to 4 (currently `nonNegInt`, fine).

### 3. Tour tier scaling on repair cost is undefined.

§12 formula: `repairCost = damagePercent * carRepairFactor * tourTierScale`. `tourTierScale` is named but no table cell exists. Pin a default while flagging it:

```ts
// Defaults until §23 ships the column. Linear with tour index.
export const TOUR_TIER_REPAIR_SCALE: Record<number, number> = {
  1: 1.0, 2: 1.15, 3: 1.30, 4: 1.50, 5: 1.75, 6: 2.05, 7: 2.40, 8: 2.80,
};
```

File a `Q-NNN` in `docs/OPEN_QUESTIONS.md` rather than freezing this without dev sign-off. Implementer must NOT proceed silently.

### 4. Reward formula pieces. Pin the integer rounding rule.

§12 base formula: `raceReward = baseTrackReward * finishMultiplier * difficultyMultiplier`. Tour bonus: `sum(raceRewards) * 0.15 on successful tour clear`. Three rounding decisions:

- Round each race reward to integer credits (no fractional credits in save-game; `SaveGameGarageSchema.credits` is `nonNegInt`).
- `Math.round` not `Math.floor` so the last-place 0.14 multiplier rewards at least 140 credits at base 1000 (round) instead of 0 (floor).
- Round the tour bonus AFTER summing the unrounded race rewards, then add. Document this so the visible "Tour bonus" line on the results screen matches what is banked.

The `difficultyMultiplier` table is missing from §12 and §23; recommend `{novice: 0.9, easy: 0.95, normal: 1.0, hard: 1.10, extreme: 1.20}` as a placeholder pin, matching the §23 CPU difficulty-pace shape. File another `Q-NNN`.

### 5. Function surface to land in economy.ts.

```ts
export function awardCredits(save: SaveGame, raceResult: RaceResult): EconomyResult<SaveGame>;
export function applyRepairCost(save: SaveGame, carId: string, zoneRepairs: ReadonlyArray<{ zone: DamageZone; toPercent: number }>, tourTier: number): EconomyResult<SaveGame>;
export function purchaseUpgrade(save: SaveGame, upgradeId: string, carId: string): EconomyResult<SaveGame>;
export function installUpgrade(save: SaveGame, upgradeId: string, carId: string): EconomyResult<SaveGame>;
export function getUpgradePrice(save: SaveGame, upgradeId: string): number;
```

`purchaseUpgrade` and `installUpgrade` are split: purchase deducts credits and grants the upgrade as "owned but not installed"; install applies it to the car (deducts a labor fee of 0 by default; reserve the slot for a future labor mechanic). For MVP the two run together via `purchaseAndInstall(save, upgradeId, carId)` convenience wrapper.

Why split? The §12 "Sport" tier is 1.8x the previous; if a player buys but cannot install (cap reached), they keep the upgrade and the credits are gone. This matches the GDD intent ("real decisions"). For Phase 2 simplicity, default the convenience wrapper.

### 6. Affected Files needs upgrade JSON loader.

Spec lists `src/data/upgrades.json` (data) but no loader. Add to Affected Files:
- `src/data/upgrades.ts` (new): `loadUpgrades(): ReadonlyMap<string, Upgrade>` reading the JSON, validating with `UpgradeSchema`, returning a `Map` keyed by id. Mirrors `src/data/cars/index.ts`.
- `src/data/__tests__/upgrades-content.test.ts` (new): every entry validates; ids are unique; every (category, tier) cell from §12 is covered.

### 7. Sharper Verify list.

- [ ] `awardCredits(save, raceResult={finishingOrder:[{carId:player, status:"finished", placement:1, raceTimeMs}], ...})` returns `state.garage.credits === save.garage.credits + Math.round(track.baseReward * 1.0 * difficultyMultiplier)` exactly.
- [ ] DNF path: `awardCredits` for a DNF returns `failure: {code:"insufficient_credits"}`? No, returns `ok: true` with cashEarned = participation cash (200 default; pin in dot). Verify deep-equal.
- [ ] `applyRepairCost(save, [{zone:"body", toPercent:0}], tourTier=1)` deducts `damagePercent * carRepairFactor * 1.0` credits and resets `state.damage[zone].percent === 0`.
- [ ] Repair on undamaged zone: returns `failure: {code:"no_damage", zone}`; state unchanged (deep-equal).
- [ ] `purchaseUpgrade` with `credits === cost - 1`: returns `failure: {code:"insufficient_credits", required:cost, available:cost-1}`.
- [ ] Tier-skip rejection: car at tier 1, attempt to install tier 3: returns `failure: {code:"tier_skip", required:2, attempted:3}`.
- [ ] At-cap rejection: car cap 2, install tier 3: returns `failure: {code:"upgrade_at_cap"}`.
- [ ] Pure: input `save` reference is the same JS object after the call (no in-place mutation) AND deep-equals the original (no nested mutation).
- [ ] Determinism: 1000 calls with same args produce deep-equal output (no Date.now, no Math.random).
- [ ] Upgrade JSON content test: every category x tier 1..4 cell present, costs match §12 example table cell-by-cell.
- [ ] No em-dashes (`grep -P '[\x{2013}\x{2014}]' src/game/economy.ts src/data/upgrades.json src/data/upgrades.ts` returns nothing).
