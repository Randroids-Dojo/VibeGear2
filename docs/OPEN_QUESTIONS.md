# Open Questions

Questions the agent has paused on, awaiting dev input. Newest at the top.
Each entry has an id (`Q-NNN`), a GDD reference, the question, options
considered, the agent's recommended default, and a status.

Statuses: `open`, `answered`, `obsolete`. Do not delete answered entries,
they are part of the design history.

---

## Q-009: Cross-tab save protocol: leader-tab election or last-write-wins?

**GDD reference:** [§21](gdd/21-technical-design-for-web-implementation.md)
"Save system" (Cross-tab consistency subsection),
[§27](gdd/27-risks-and-mitigations.md) "Cross-tab save corruption" row.
**Status:** open
**Asked in loop:** 2026-04-26

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

---

## Q-008: Tire modifiers for §23-uncovered weathers (`light_rain`, `dusk`, `night`)

**GDD reference:** [§23](gdd/23-balancing-tables.md) "Weather modifiers",
[§14](gdd/14-weather-and-environmental-systems.md) "Weather types",
[§22](gdd/22-data-schemas.md) "Weather option enum"
**Status:** open
**Asked in loop:** 2026-04-26

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

---

## Q-007: Practice mode weather preview surface

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #4, [§6](gdd/06-game-modes.md) "Practice mode"
**Status:** open
**Asked in loop:** 2026-04-26

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

**Blocking?** No. The catch-up module ships today with option (a);
the practice slice may revisit.

---

## Q-006: Easy-mode tour-clear bonus rate

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #3
**Status:** open
**Asked in loop:** 2026-04-26

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

**Blocking?** No.

---

## Q-005: Essential-repair cap fraction

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #2
**Status:** open
**Asked in loop:** 2026-04-26

**Question.** §12 says "essential repairs are capped at a low
percentage of race income" without pinning the percentage. Pinned
0.40 (`REPAIR_CAP_FRACTION` in `src/game/catchUp.ts`) per the dot
spec. Repair cap applies on easy and normal only; hard, master, and
extreme always pay full price. Does dev want a different fraction
or a different difficulty gate?

**Recommended default.** 0.40 with the easy / normal gate. Lands
the lever now; balancing pass owns the final number.

**Blocking?** No.

---

## Q-004: Tour stipend threshold and amount

**GDD reference:** [§12](gdd/12-upgrade-and-economy-system.md) "Catch-up
mechanisms" #1
**Status:** open
**Asked in loop:** 2026-04-26

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

**Blocking?** No.

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
MIT (`LICENSE` at repo root, sibling chore slice). Original art, sound
effects, and music ship under CC-BY-4.0 by default. Track and community
data ship under CC-BY-SA-4.0 per GDD section 26 ("Suggested licenses"
table). Public-domain (`CC0-1.0` or `public-domain`) is permitted on a
per-entry basis for contributed assets that arrive with that grant.
Implemented by `feat/assets-license`: `ASSETS-LICENSE` at repo root with
the CC BY 4.0 text and the per-entry licence taxonomy,
`AssetEntry.license` required on every manifest entry,
`assertManifestLicenses` runtime guard for the future mod loader,
default licences encoded in `DEFAULT_ASSET_LICENSES` in
`src/asset/manifest.ts`, and unit tests that pin the contract.

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
