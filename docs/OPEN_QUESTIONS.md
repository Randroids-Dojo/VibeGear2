# Open Questions

Questions the agent has paused on, awaiting dev input. Newest at the top.
Each entry has an id (`Q-NNN`), a GDD reference, the question, options
considered, the agent's recommended default, and a status.

Statuses: `open`, `answered`, `obsolete`. Do not delete answered entries,
they are part of the design history.

---

## Q-011: Leaderboard storage provider after Vercel KV sunset

**GDD reference:** [§21](gdd/21-technical-design-for-web-implementation.md)
"leaderboard back end concept", [§24](gdd/24-content-plan.md) "Online
leaderboard".
**Status:** open
**Asked in loop:** 2026-04-29

**Question.** F-030 asked the agent to provision Vercel KV and flip
`LEADERBOARD_BACKEND=vercel-kv` in production. Current Vercel docs say
Vercel KV is no longer available for new projects, and Redis storage now
comes through Marketplace integrations that inject env vars into the
project. Which backend should the leaderboard use?

- **(a) Upstash Redis through Vercel Marketplace (recommended).** Closest
  successor to the old Vercel KV path. Vercel docs say old Vercel KV stores
  were moved to Upstash Redis, and Marketplace storage docs name Upstash
  Redis for key-value use cases. Requires dev approval for provider,
  pricing plan, env injection, and production env flips.
- **(b) Redis Cloud through Vercel Marketplace.** Also listed as a Vercel
  Marketplace Redis option. Requires choosing a Redis provider and adapting
  any env names or SDK calls that differ from the current `KvLike` adapter.
- **(c) Keep the noop backend for v1.0.** No external service, no paid
  integration, and no env change. Leaves online leaderboard as a later
  post-v1.0 feature.
- **(d) Use a non-Marketplace Redis or serverless data store.** Flexible,
  but adds more manual credential handling and more docs work than the
  Marketplace path.

**Recommended default.** (a), but do not proceed without dev confirmation.
This crosses the working-agreement gate for paid services and production
environment changes. Once approved, create a replacement followup for the
chosen provider and update the current `vercel-kv` adapter name if needed.

**Blocking?** Yes for replacing F-030. It is not blocking local gameplay
because the noop leaderboard path still deploys and the client remains
feature-flagged off.

## Q-010: `tourTierScale` table for the §12 repair-cost formula

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Repair
costs" (`repairCost = damagePercent * carRepairFactor * tourTierScale`),
[§23](gdd/23-balancing-tables.md) "Repair cost tour tier scale".
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** §12 names a `tourTierScale` factor in the repair-cost
formula but §23 did not pin a tour-by-tour value table. F-033
(`Implement applyRepairCost once §23 ships tourTierScale`) was blocked
until this column existed. The iter-19 stress-test on
`VibeGear2-implement-economy-upgrade-ff73b279` proposed a placeholder
table (`1.00, 1.15, 1.30, 1.50, 1.75, 2.05, 2.40, 2.80` for tours 1..8)
but flagged that the implementer must NOT freeze it without dev sign-off.
Which table should §23 pin?

- **(a) Adopt the iter-19 placeholder.** `[1.00, 1.15, 1.30, 1.50, 1.75,
  2.05, 2.40, 2.80]` for tours 1..8. Smooth geometric-ish ramp ending
  near 2.8x in the late tours. Matches the dot proposal verbatim;
  callers can land immediately.
- **(b) Linear ramp.** `1.0 + 0.2 * (tier - 1)` -> `[1.0, 1.2, 1.4, 1.6,
  1.8, 2.0, 2.2, 2.4]`. Easier to memorize and unit-test; flatter late
  curve so endgame repair bites less. Requires balancing-pass to
  confirm the credits-per-race economy still pressures the player to
  upgrade armor.
- **(c) Steeper late curve.** `[1.00, 1.20, 1.50, 1.85, 2.30, 2.85, 3.55,
  4.40]` (~1.25x growth per tier). Matches the §12 prize-pool multiplier
  cadence so repair eats a stable fraction of winnings instead of
  shrinking late-game. Bigger pain spike if the player skips armor
  upgrades.
- **(d) Defer.** Land `applyRepairCost` against a single constant scale
  of `1.0` for all tiers and revisit when §23 gets a pass. Safe but
  silently ignores §12's intent; risks the same "pure module, no
  consumers" pattern noted in earlier iterations once F-033 lands.

**Recommended default.** (a). The iter-19 table is the closest thing to
a designed proposal already in the loop; freezing it lets F-033 and
F-036 (the `cappedRepairCost` consumer) both unblock with one sign-off.
If a balancing pass later prefers (b) or (c), the table is one §23 edit
plus one constant swap in `economy.ts`.

**Resolution.** Adopted option (a). §23 now carries the "Repair cost
tour tier scale" table with the iter-19 values for tours 1..8; tours
beyond 8 reuse the tour-8 value until a future content slice extends
the championship. The `TOUR_TIER_SCALE` lookup and `tourTierScale(tour)`
resolver now live in `src/game/economy.ts` (the same module that owns
the §23 reward table and will own `applyRepairCost`). The
`balancing.test.ts` content test pins each cell so a §23 edit fails the
build at a single readable site. F-033 unblocked.

**Blocking?** Was yes for F-033 (`applyRepairCost`) and transitively
F-036 (`cappedRepairCost` consumer wiring). Resolved.

---

## Q-009: Cross-tab save protocol: leader-tab election or last-write-wins?

**GDD reference:** [§21](gdd/21-technical-design-for-web-implementation.md)
"Save system" (Cross-tab consistency subsection),
[§27](gdd/27-risks-and-mitigations.md) "Cross-tab save corruption" row.
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** The cross-tab slice
(`VibeGear2-implement-cross-tab-fa8cb14c`) shipped a last-write-wins
protocol with a monotonic `writeCounter` advisory plus
`subscribeToSaveChanges` and `reloadIfNewer`. The dot text named
last-write-wins as the recommended default and called out
leader-tab election as a possible alternative. Should we upgrade?

- **(a) Keep last-write-wins (recommended).** Simplest. Works in every
  supported browser without `BroadcastChannel`. The data is local-only
  in the MVP and the players-with-two-tabs population is small. The
  `writeCounter` advisory plus the focus revalidate already cover the
  "free upgrade by stale tab" failure case named in the dot.
- **(b) Leader-tab election via `BroadcastChannel`.** One tab is
  authoritative for writes; followers send writes to the leader and
  receive a broadcast on every accepted change. Adds complexity:
  leader handoff on close, election protocol, two-leader resolution
  on race conditions. Buys deterministic write ordering inside a
  single user session. Probably overkill until cloud sync arrives.
- **(c) Defer to cloud sync.** The Save system section already names
  cloud sync as an optional later phase. Cross-tab gets resolved
  for free once writes go through a server. Risk: cloud sync may not
  ship for months and the local-only failure persists in the
  meantime.

**Recommended default.** (a). Keep last-write-wins until either §27
gains a higher-priority cross-tab risk or cloud sync starts landing
and we can switch to (c) directly. (b) is added complexity for a
narrow benefit.

**Resolution.** Adopted option (a). The
`feat/cross-tab-save-consistency` slice (commit `923d6f9`) already
ships last-write-wins with the `writeCounter` advisory,
`subscribeToSaveChanges`, and `reloadIfNewer` in
`src/persistence/save.ts`; no protocol upgrade is owed. Re-evaluate
only when one of the named triggers fires: §27 raises the cross-tab
risk row above the current "Cross-tab save corruption" mitigation
weight, or a cloud sync slice starts landing (at which point we
switch directly to option (c) and retire the local-only protocol).
Leader-tab election (option (b)) stays rejected for the MVP because
it adds election, handoff, and two-leader resolution complexity for a
narrow population (players with two tabs open against the same save)
without buying enough determinism to justify the surface.

**Blocking?** No. The protocol shipped under the recommended default;
this resolution only confirms no upgrade is required. Resolved.

---

## Q-008: Tire modifiers for §23-uncovered weathers (`light_rain`, `dusk`, `night`)

**GDD reference:** [§23](gdd/23-balancing-tables.md) "Weather modifiers",
[§14](gdd/14-weather-and-environmental-systems.md) "Weather types",
[§22](gdd/22-data-schemas.md) "Weather option enum"
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-28

**Question.** `WeatherOption` (the `TrackSchema`-validated enum in
`src/data/schemas.ts`) declares eight values: `clear`, `light_rain`,
`rain`, `heavy_rain`, `fog`, `snow`, `dusk`, `night`. §23 "Weather
modifiers" only specifies five of them (Clear, Rain, Heavy rain, Snow,
Fog). When a track JSON authors `weatherOptions: ["light_rain"]` and a
runtime physics consumer asks `getWeatherTireModifier("light_rain")`,
what should the lookup return? The current binding returns
`undefined` and forces the call site to decide; the parent dot
`VibeGear2-implement-weather-38d61fc2` will need to pick one of:

- **(a) Pin to identity.** Return `{ dryTireMod: 0, wetTireMod: 0 }`
  for every uncovered weather. Cheapest, but silently ignores any
  authoring intent (a `night` track should arguably reduce reaction
  time rather than pretend it is grip-neutral).
- **(b) Alias to the nearest §23 row.** `light_rain` -> `rain`,
  `dusk` -> `clear`, `night` -> `clear` (or `fog` for the visibility
  bias). Requires picking the alias map up-front.
- **(c) Reject in the schema.** Drop `light_rain`, `dusk`, `night`
  from `WeatherOptionSchema` until §23 pins them. Breaks the
  existing track JSON fixtures that already author them.
- **(d) Extend §23 to cover all eight.** GDD edit; the parent
  weather dot owns this decision.

**Recommended default.** Option (a) for the wiring slice in the
parent dot, paired with a §14 doc note that the three uncovered
weathers are "visibility variants" rather than "grip variants" and a
follow-up content lint that warns when a track lists an uncovered
weather without also listing a §23 row to fall back to. Option (d)
is the right long-term answer; option (a) ships the parent dot
without blocking on a GDD edit.

**Blocking?** No. The tire-modifier table itself ships today with
the §23-row subset; no runtime consumer reads the lookup yet. The
parent weather dot picks a resolution before its physics integration
lands.

**Resolution.** Adopted option (b) for the first runtime consumer:
`light_rain` aliases to Rain, `dusk` aliases to Clear, and `night`
aliases to Clear for tire-grip math. The weather grip runtime slice
documents the alias map in §23 and pins it in
`WEATHER_TIRE_MODIFIER_ALIASES`. Dusk and night still reduce read
distance through `WEATHER_VISIBILITY`, so they are not fully neutral;
they are grip-neutral. Full per-weather balancing rows remain optional
future tuning, but no runtime caller receives `undefined`.

---

## Q-007: Practice mode weather preview surface

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #4, [§6](gdd/06-game-modes.md) "Practice mode"
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** §12 says "practice mode can preview track weather so bad
setup choices feel fair, not hidden." The catch-up module currently
returns the track's full `weatherOptions` array verbatim
(`practiceWeatherPreview`) so the player sees every weather the track
might roll. Should the practice surface (a) keep this deterministic
"all options" preview, (b) preview the actual seeded roll for the
upcoming session (so the player sees the exact weather), or (c)
preview a probability-weighted sample? Option (a) is fair but reveals
no per-session info; (b) leaks the seed to the UI which complicates
the §21 deterministic-replay invariants; (c) needs a probability
table that §12 does not pin.

**Recommended default.** Option (a). Keep the deterministic full-set
preview until the practice-mode slice
(`VibeGear2-implement-practice-quick-ad3ba399`) confirms with dev
which surface is right. Option (a) ships now and is the smallest
spec.

**Resolution.** Adopted option (a). The `practiceWeatherPreview(track)`
helper in `src/game/catchUp.ts` already returns the track's
`weatherOptions` array unchanged (typed `ReadonlyArray<WeatherOption>`
so callers cannot mutate the track JSON by accident). The practice-mode
slice (`VibeGear2-implement-practice-quick-ad3ba399`) consumes that
helper directly; no per-session seeded roll is surfaced to the UI, and
no probability-weighted sample is drawn. Two re-evaluation triggers
gate any future swap to (b) or (c): the practice-mode slice landing a
surface that requires per-session info (e.g. a stake-on-the-line race
modifier where setup risk needs the exact roll), or §12 pinning a
probability table that justifies option (c). Option (b) stays rejected
unless the §21 deterministic-replay invariants are revisited
(seed-leakage to the UI breaks the invariant that the seed is
derivable only from save state plus race-config inputs). Catch-up
mechanism #4 in §12 is now satisfied by the shipping helper.

**Blocking?** No. The catch-up module ships today with option (a);
this resolution only confirms no surface change is owed and pins the
re-evaluation triggers. Resolved.

---

## Q-006: Easy-mode tour-clear bonus rate

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #3, [§23](gdd/23-balancing-tables.md) "Easy-mode tour-clear
bonus (catch-up mechanism #3)"
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** §12 says "easy mode grants bonus cash for tour clears"
on top of the flat 0.15x §12 tour bonus, but does not pin the bonus
rate. Pinned 0.20x of summed race rewards
(`EASY_MODE_TOUR_BONUS_FRACTION` in `src/game/catchUp.ts`) so the
total easy-mode tour-clear payout is `0.15 + 0.20 = 0.35x` of summed
race rewards. Does dev want a different rate (lower for less
dependency, higher for more catch-up runway)?

**Recommended default.** 0.20x. Lands the lever now and keeps the
balancing-pass slice
(`VibeGear2-implement-balancing-pass-71a57fd5`) responsible for
final tuning.

**Resolution.** Adopted the recommended default verbatim. The pinned
constant `EASY_MODE_TOUR_BONUS_FRACTION = 0.2` in
`src/game/catchUp.ts` stays unchanged, the `easy`-only difficulty
gate in `easyModeBonus` stays unchanged, and the negative-entry /
empty tour-complete clamps (which mirror `tourBonus`) stay unchanged.
The F-037 consumer slice (wire `easyModeBonus` into the tour-clear
bonus payout) is still owed and will append a sibling `bonuses` entry
alongside `tourBonus` so the §20 receipt renders the easy-mode bonus
on its own line; this resolution only confirms no value change is
owed and pins the row in §23. §23 now carries a "Easy-mode tour-clear
bonus (catch-up mechanism #3)" subsection between "Repair cap
(catch-up mechanism #2)" and "Damage formula targets" that pins the
fraction, the difficulty gate, the negative-entry policy, and the
empty tour-complete clamp on a single page so the balancing-pass
slice (`VibeGear2-implement-balancing-pass-71a57fd5`) finds every
lever in one place. Two re-evaluation triggers gate any future swap:
a balancing-pass run that shows the easy-mode runway is too short
(player runs out of credits between tours despite the bonus, raise
the fraction toward 0.30) or too generous (player out-earns harder
difficulties on a per-tour basis, lower the fraction toward 0.15), or
a §12 / §15 edit that retunes the per-race cash awards or the flat
0.15x `tourBonus` rate the fraction was calibrated against. Q-007
(practice-mode weather preview) is already answered in its own §12
catch-up slot; this slice does not pre-empt other open questions.

**Blocking?** No. The constant ships today with the recommended
default and the F-037 consumer is still owed; this resolution only
confirms no value change is owed and pins the §23 row. Resolved.

---

## Q-005: Essential-repair cap fraction

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #2, [§23](gdd/23-balancing-tables.md) "Repair cap
(catch-up mechanism #2)"
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** §12 says "essential repairs are capped at a low
percentage of race income" without pinning the percentage. Pinned
0.40 (`REPAIR_CAP_FRACTION` in `src/game/catchUp.ts`) per the dot
spec. Repair cap applies on easy and normal only; hard, master, and
extreme always pay full price. Does dev want a different fraction
or a different difficulty gate?

**Recommended default.** 0.40 with the easy / normal gate. Lands
the lever now; balancing pass owns the final number.

**Resolution.** Adopted the recommended default verbatim. The
pinned constant `REPAIR_CAP_FRACTION = 0.4` in `src/game/catchUp.ts`
stays unchanged, the `essential`-only repair-kind gate stays
unchanged, and the easy / normal / novice difficulty gate in
`isCapEligibleDifficulty` stays unchanged. The F-036 consumer slice
(`feat/wire-capped-repair-cost`, commit `3ed8720`) already wires
`cappedRepairCost` into `applyRepairCost` so this resolution only
confirms no value change is owed and pins the row in §23. §23 now
carries a "Repair cap (catch-up mechanism #2)" subsection between
"Tour stipend (catch-up mechanism #1)" and "Damage formula targets"
that pins the fraction, the repair-kind gate, the difficulty gate,
and the zero-income clamp on a single page so the balancing-pass
slice (`VibeGear2-implement-balancing-pass-71a57fd5`) finds every
lever in one place. Two re-evaluation triggers gate any future
swap: a balancing-pass run that shows the cap is firing too often
(raise the fraction toward 0.5) or never engaging because the cap
ceiling never beats the raw cost (lower the fraction or extend the
difficulty gate to include hard), or a §12 / §15 edit that retunes
the per-race cash awards or the per-zone repair costs that the
fraction was calibrated against. Q-006 (easy-mode tour-clear bonus
rate) stays open in its own §12 catch-up slot; this slice does not
pre-empt its resolution.

**Blocking?** No. The constant ships today with the recommended
default and the F-036 consumer is already wired; this resolution
only confirms no value change is owed and pins the §23 row.
Resolved.

---

## Q-004: Tour stipend threshold and amount

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #1, [§23](gdd/23-balancing-tables.md) "Catch-up mechanism
levers"
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** §12 says "players below a cash threshold receive a
tour stipend" without pinning the threshold or grant amount. Pinned
`STIPEND_THRESHOLD_CREDITS = 1500` and `STIPEND_AMOUNT = 1000` in
`src/game/catchUp.ts`. The first-tour gate (no stipend on tour 1)
and one-claim-per-tour invariant are encoded in `computeStipend`.
Does dev want different numbers or a different gate?

**Recommended default.** Keep 1500 / 1000 with the first-tour gate.
The threshold buys roughly two tier-1 cooling upgrades; the amount
matches a mid-table finish at base 2000 / normal so the lever is a
catch-up not a free win.

**Resolution.** Adopted the recommended default. The pinned
constants `STIPEND_THRESHOLD_CREDITS = 1500` and
`STIPEND_AMOUNT = 1000` in `src/game/catchUp.ts` stay verbatim;
`computeStipend` keeps the three-clause gate (tour index >= 2,
wallet strictly below threshold, no prior claim recorded). The
F-035 consumer slice (`feat/f-035-stipend-at-tour-entry`, commit
`927e797`) wires the lever into `enterTour` and records the claim
via `recordStipendClaim`, so this resolution only confirms no value
change is owed. §23 now carries a "Tour stipend (catch-up
mechanism #1)" subsection that pins the threshold and amount on a
single page so the balancing-pass slice
(`VibeGear2-implement-balancing-pass-71a57fd5`) finds the numbers
without grepping `catchUp.ts`. Two re-evaluation triggers gate any
future swap: a balancing-pass run that shows the stipend lever is
firing too rarely (raise the threshold) or too generously (lower
the amount), or a §12 / §15 edit that retunes the starter cash and
mid-table reward sizing this constant was calibrated against.
Q-005 (repair cap fraction) and Q-006 (easy-mode tour-clear bonus
rate) stay open in their own §12 catch-up slots; this slice does
not pre-empt their resolutions.

**Blocking?** No. The constants ship today with the recommended
default and the F-035 consumer is already wired; this resolution
only confirms no value change is owed and pins the §23 row.
Resolved.

---

## Q-003 — Auto-deploy target

**GDD reference:** [§21](gdd/21-technical-design-for-web-implementation.md), §26
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** Where should `main` auto-deploy to? Options: Vercel (matches
Next.js defaults), Cloudflare Pages, Netlify, GitHub Pages with a static
export, or self-hosted.

**Recommended default.** Vercel preview + production, free tier, configured
via a `vercel.json` and a GitHub Action triggered on push to `main`. Easy to
swap later because the app stays static-exportable.

**Resolution.** Vercel Hobby (free tier, region `iad1`) with GitHub Actions
gating production deploys. Two-job workflow: `verify` runs lint + typecheck
+ Vitest + Playwright on every PR and on push to `main`; `deploy` runs only
on push to `main` after `verify` is green, using `vercel build --prod` +
`vercel deploy --prebuilt --prod` so the build runs in CI logs and the
artefact is what ships. `verify` and `deploy` use separate concurrency
groups: `verify` cancels stale runs, `deploy` does not, so a rapid second
push cannot abort an in-flight production deploy. The Vercel GitHub App
handles PR previews. Required secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`. Cloudflare Pages, Netlify, GitHub Pages, and
self-hosted were rejected (rationale in the closing reason of dot
`VibeGear2-research-choose-deploy-bcfb9148`). See the recovery slice
`feat/github-actions-ci-recovery` (re-applied work originally on
`feat/github-actions-ci`, dot `VibeGear2-implement-github-actions-1780fc58`).

**Blocking?** Yes for `F-003`. Resolved.

---

## Q-002 — Licence choice

**GDD reference:** §1 ("Code under a permissive open-source license. Assets
under original permissive asset licenses."), §26
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** Which permissive licence for code (MIT vs Apache-2.0 vs BSD-2)
and which for assets (CC0 vs CC-BY-4.0 vs CC-BY-SA-4.0)?

**Recommended default.** MIT for code (broadest compatibility, simplest),
CC-BY-4.0 for original assets (credit required, remix allowed). Add `LICENSE`
and `ASSETS-LICENSE` files at repo root.

**Resolution.** Adopted the recommended defaults. Code is licensed under
MIT (`LICENSE` at repo root, `package.json` license field). Original art,
sound effects, and music ship under CC-BY-4.0 by default via
`ASSETS-LICENSE`. Track, championship, balancing, and community mod data
ship under CC-BY-SA-4.0 via `DATA-LICENSE` per GDD section 26
("Suggested licenses" table). Public-domain (`CC0-1.0` or
`public-domain`) is permitted on a per-entry basis for contributed assets
that arrive with that grant. Implemented by `feat/assets-license` and
`feat/licence-files-finalisation-loop`: `AssetEntry.license` is required
on every manifest entry, `assertManifestLicenses` guards future mod
loading, default licences are encoded in `DEFAULT_ASSET_LICENSES` in
`src/asset/manifest.ts`, README links the three root license files, and
unit tests pin the manifest contract.

**Blocking?** No for early implementation, yes before any public release.
Resolved.

---

## Q-001 — Section 21 stack confirmation

**GDD reference:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Status:** answered
**Asked in loop:** 2026-04-26
**Answered in loop:** 2026-04-26

**Question.** [`docs/gdd/01-title-and-high-concept.md`](gdd/01-title-and-high-concept.md) says: "Reuse VibeRacer patterns:
Next.js, React, TypeScript, custom math, Web Audio, local storage, schema
validation, and automated tests." Should §21 simply codify that exact stack,
or is anything intended to differ (e.g. SvelteKit, Vite, no React)?

**Recommended default.** Codify exactly the stated stack: Next.js (App
Router), React 18, TypeScript strict, Vitest for unit, Playwright for e2e,
Zod for schema validation, Web Audio for sound, Canvas2D for the road
renderer.

**Resolution.** §21 already exists in the canonical Markdown tree and
specifies the recommended layers (App shell, Runtime core, Renderer, Audio,
Data, Persistence, Mod layer) along with the suggested module structure under
`src/game/`, `src/road/`, `src/render/`. The Phase 0 scaffold slice adopts
that structure verbatim with the recommended default stack: Next.js 15 (App
Router), React 18, TypeScript 5 strict, Zod 3, Vitest 2 for unit. Playwright,
GitHub Actions CI, and the auto-deploy target (Q-003) ship in their own
slices. See the matching `PROGRESS_LOG.md` entry.

**Blocking?** Yes for Phase 0 project skeleton (`F-002`). Resolved.
