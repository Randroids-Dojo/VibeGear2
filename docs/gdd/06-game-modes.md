# 6. Game modes

**Status:** partial

## v1.0 scope

Per Q-015 (2026-05-06), v1.0 ships only the **Championship (World Tour)**
mode. Quick Race, Time Trial, Practice, and Community Challenge are
**deferred post-v1.0** so every fun-factor slice compounds on a single
race surface (matching the Top Gear 2 reference). The non-Tour entries
are documented below for the post-v1.0 roadmap; the title-screen menu
in v1.0 only exposes World Tour, Garage, and Options (plus the legacy
Start Race shortcut). See F-090 for the deeper code deletion (route
directories, mode-state machines, related test files).

## Championship

The centerpiece mode. The player progresses through tours of four races each, managing cash, repairs, and upgrades between events.

## Quick race

Pick any unlocked track, weather variant, and car/setup. No campaign economy.

## Time trial

Solo run on any unlocked track against personal best, developer benchmark, or downloaded ghost.

## Practice

A no-stakes test session with restart, checkpoint reset, visible grip telemetry, and instant weather swap.

## Community challenge

A rotating daily or weekly seeded challenge is appropriate after v1.0, using an official track, locked car class, and sometimes forced weather. This should be asynchronous, not a live-service dependency.

## Stretch goals

- Local split-screen on large desktop displays.
- Ghost-versus mode.
- Community track of the week.
- Endurance cup.
- Mirror tracks or reverse variants.

### Build log

- 2026-05-06: Q-015 v1.0 scope cut. Title screen menu now exposes only
  World Tour / Garage / Options (plus Start Race). Time Trial / Quick
  Race / Practice / Daily Challenge entries removed from the menu. Underlying
  routes, modules, and tests remain in the tree under F-090. Files:
  `src/app/page.tsx`, `src/app/__tests__/page.test.tsx`,
  `e2e/title-screen.spec.ts`. PR pending.
