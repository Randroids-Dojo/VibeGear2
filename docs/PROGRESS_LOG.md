# Progress Log

Append a new entry at the **top** of this file at the end of every loop. Use
the template from `IMPLEMENTATION_PLAN.md` §6. Never delete past entries —
correct them by adding a new entry that references the old one.

---

## 2026-04-26: Slice: Arcade physics step for player car (§10)

**GDD sections touched:** [§10](gdd/10-driving-model-and-physics.md), [§11](gdd/11-cars-and-stats.md), [§23](gdd/23-balancing-tables.md)
**Branch / PR:** `feat/arcade-physics`, PR pending
**Status:** Implemented

### Done
- Added `src/game/physics.ts` exposing the pure step function
  `step(state, input, stats, context, dt) -> CarState`. Implements §10's
  acceleration / top-speed clamp / brake / coasting drag / lane-relative
  steering / off-road slowdown. State is the minimal `{ z, x, speed }`
  triple; future slices for traction loss, drifting, jumps, drafting,
  nitro, weather, damage, and collisions can extend it additively.
- Tunable constants surfaced from §10 "Suggested tunable constants":
  `OFF_ROAD_CAP_M_PER_S`, `OFF_ROAD_DRAG_M_PER_S2`,
  `COASTING_DRAG_M_PER_S2`, `STEER_RATE_LOW_RAD_PER_S`,
  `STEER_RATE_HIGH_RAD_PER_S`. Started with the starter-tier values; the
  per-car `topSpeed`, `accel`, `brake`, `gripDry` from
  `data/cars/*.json` drive the per-vehicle behaviour.
- Steering uses the §10 lerp: `steerRate = lerp(low, high,
  speed/topSpeed)`, then `yawDelta = steerInput * steerRate * dt *
  tractionScalar`. Lateral velocity is `yawDelta * speed`, which gives
  the dot's "no lateral movement at zero speed" behaviour for free.
- Off-road detection uses `Math.abs(x) > roadHalfWidth` against the
  renderer's `ROAD_WIDTH` constant. Off-road halves grip and applies
  `OFF_ROAD_DRAG`, then caps speed at `OFF_ROAD_CAP`. Damage on
  persistent off-road at high speed is deferred to the §13 damage slice.
- Re-exported physics from `src/game/index.ts`.
- Added `src/app/dev/physics/page.tsx`. Drives the starter car
  (Sparrow GT) along a 12 km straight using the deterministic input
  layer and the same `startLoop` 60 Hz cadence the real race uses.
  Shows live speed (m/s and km/h), lateral x, forward z, off-road
  flag, and per-input values for visual smoke.
- Added `src/game/__tests__/physics.test.ts` (27 cases). Covers
  acceleration curve, top-speed clamp, brake (no inversion past zero,
  brake-from-zero stays at zero, brake + throttle held), coasting
  drag, steering (zero at zero speed, magnitude scales with input,
  authority drops with speed), off-road detection / drag / cap,
  dt = 0 / negative / NaN edge cases, purity, determinism (1000-run
  identical-output check + 100-step trajectory equality), and
  forward-z integration sanity.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 159/159 (27 new + 132 prior).
- `npm run build` succeeds; `/dev/physics` ships as a static route at
  3.6 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the four touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/physics` deferred to a human run
  of `npm run dev`. Unit tests cover the math; the dev page is for
  feel-checking.

### Decisions and assumptions
- The yaw-equation in §10 produces an angular delta. The MVP renderer
  does not show vehicle heading, so we project the yaw onto a lateral
  velocity by multiplying by forward speed. This matches the dot's
  "lane-relative" steering and the design pillar that "steering at
  zero speed produces no lateral movement". A future slice that
  introduces a real heading angle replaces the projection but keeps
  the §10 equation intact.
- Coasting drag and steering rates are sourced from the §10 "starter
  target" column. A future balancing slice can plumb mid / late tier
  values per car class. The per-car `gripDry` already differentiates
  the starter cars (Sparrow 1.00, Breaker 1.08, Vanta 0.93).
- Brake clamps at zero rather than inverting (no reverse in MVP).
  Reverse is not in §10's MVP scope and the dot lists "brake while
  reversing: do not invert velocity past zero" as a hard edge case.
- Off-road halves `gripDry` and applies `OFF_ROAD_DRAG`. §10 says
  "reduce traction" + "apply strong drag" + "cap top speed"; the half
  and the cap together give a readable transition without over-tuning
  the constant. Persistent off-road damage is deferred to F-015.
- The physics step is pure: no globals, no time source, no RNG.
  Determinism is mandatory per AGENTS.md RULE 8 so the §21 ghost /
  replay system can rebuild identical traces from a recorded input
  stream.
- Brake + throttle held at the physics layer applies both forces (net
  delta = (accel - brake) * dt). The input layer already resolves the
  ambiguous "both keys held" case to throttle = 0, brake = 1 before
  reaching physics, so the only callers that hit the physics-layer
  combination are tests, AI drivers (intentional), and replay
  playback.

### Followups created
- F-015 in FOLLOWUPS.md: persistent off-road damage. §10 calls it out
  ("Increase damage slightly if the player persists off-road at high
  speed") but damage is owned by the §13 slice.

### GDD edits
- None. The implementation conforms to §10 as written.

---

## 2026-04-26: Slice: Keyboard + gamepad input layer (§19)

**GDD sections touched:** [§19](gdd/19-controls-and-input.md), [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/keyboard-gamepad-input` (off `main`), PR pending
**Status:** Implemented

### Done
- Added `src/game/input.ts` exposing the canonical `Input` shape
  (`steer`, `throttle`, `brake`, `nitro`, `handbrake`, `pause`, `shiftUp`,
  `shiftDown`), `NEUTRAL_INPUT`, `DEFAULT_KEY_BINDINGS` (matching §19's
  keyboard + gamepad tables), pure helpers `inputFromActions`,
  `inputFromGamepad`, `mergeInputs`, `applyDeadzone`, plus the stateful
  `createInputManager(opts)` that subscribes to keyboard + Gamepad API
  sources and exposes `sample()`, `dispose()`, and `hasGamepad()`.
- The manager samples once per fixed sim step (sim calls `sample()`
  inside the simulate callback). Browser events only mutate the held
  set; the snapshot is built at sample time. This satisfies the §21
  determinism requirement for the upcoming replay/ghost system.
- Implemented the §19 cancellation rule for opposite directions (Left +
  Right held resolves to steer = 0). Brake + Accelerate held resolves
  to throttle = 0, brake = 1 since stop is the safer ambiguous default.
- Window blur clears all held keys so a tab-out cannot leave the player
  with stuck throttle / steer when focus returns. Gamepad disconnect is
  silent: the manager polls on each sample and falls back to keyboard
  with no crash.
- Re-exported the input surface from `src/game/index.ts`.
- Added `src/app/dev/input/page.tsx` showing live sampled values,
  driven by the same `startLoop` cadence the real race uses. Useful for
  visually verifying held keys, the cancellation rule, and pad input.
- Added `src/game/__tests__/input.test.ts` (27 cases): pure-helper
  contracts, deadzone math, cancellation rule, blur clears state,
  gamepad-source-throws survives, dispose unhooks all listeners,
  custom bindings, and headless null-keyTarget mode.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 132/132 (27 new + 105 existing).
- `npm run build` succeeds; `/dev/input` ships as a static route at
  2.61 kB.
- `grep -P '[\x{2013}\x{2014}]'` across the four touched files returns
  nothing (no em-dashes, no en-dashes).
- Manual visual verification at `/dev/input` deferred to a human run of
  `npm run dev` since the agent environment cannot drive a real
  browser. The unit tests cover the keyboard-event mapping and
  cancellation rule end-to-end via injected `KeyTarget`, so the
  remaining manual check is "does Gamepad API actually populate".

### Decisions and assumptions
- The `Input` shape includes `handbrake`, `shiftUp`, and `shiftDown`
  alongside the dot's listed fields. §19 enumerates handbrake and
  manual shifts under both keyboard and pad layouts, so leaving them
  out would force a breaking change once those slices land. The
  default state for the new fields is `false`, so consumers that only
  read `steer/throttle/brake/nitro/pause` are unaffected.
- Keyboard tokens are matched against both `KeyboardEvent.code` and
  `KeyboardEvent.key`. `code` is the layout-independent identifier
  (e.g. `KeyW`) and is preferred for letters; `key` is needed for
  Escape, ArrowUp, etc. The default binding map lists both styles per
  action and the lookup accepts either, which keeps the API friendly to
  test fixtures while staying layout-independent in production.
- Brake-wins on simultaneous accelerate + brake. The dot's edge-case
  list does not specify the resolution; safer to stop than to keep
  throttle. Documented in `inputFromActions`.
- Stick deadzone defaults to 0.15 (most racing games), trigger
  deadzone to 0.05. §19 calls out steering smoothing as an
  accessibility feature; it is intentionally not modelled here. A
  future settings slice can plumb both deadzones through
  `InputManagerOptions`.
- Touch / mobile is out of scope per the dot; F-013 captures the
  followup so the desktop slice does not silently absorb that
  workload.
- The dev page samples inside `simulate`, not `render`, so the
  displayed values are exactly what the sim sees. React state pushes
  are throttled to ~30 Hz to keep the page off the fixed-step hot path.

### Followups created
- F-013 (`nice-to-have`): touch and mobile input. §19 explicitly defers
  this; tracked so it does not get lost.
- F-014 (`nice-to-have`): user-facing key remapping UI + persistence.
  The schema for control profiles already has a slot in `SaveSchema`
  but the UI to edit and persist them is its own slice.

### GDD edits
- None. The shape and bindings match §19 and §21 as written.

---

## 2026-04-26: Slice: Car set + stats (§11) and garage car selector

**GDD sections touched:** [§11](gdd/11-cars-and-stats.md), [§22](gdd/22-data-schemas.md), [§23](gdd/23-balancing-tables.md)
**Branch / PR:** `feat/car-set-stats` (off `main`), PR pending
**Status:** Implemented

### Done
- Authored the six MVP cars from §11 + §23 as JSON files under
  `src/data/cars/`: `sparrow-gt.json`, `breaker-s.json`, `vanta-xr.json`,
  `tempest-r.json`, `bastion-lm.json`, `nova-shade.json`. Stats match the
  §23 "Core car balance sheet" exactly. Brake values (which §23 omits)
  scale with topSpeed and grip per starter vs. late-game tier.
- Added `src/data/cars/index.ts` exposing `CARS`, `CARS_BY_ID`,
  `STARTER_CAR_ID`, and `getCar(id)`. Re-exported from
  `src/data/index.ts` so the rest of the app can `import { getCar } from
  "@/data"`. Sparrow GT (purchasePrice 0) is the granted starter, matching
  the existing `defaultSave()` invariant in `src/persistence/save.ts`.
- Updated `src/data/schemas.ts`:
  - `CarClassSchema` now enumerates the §11 classes (`sprint`, `balance`,
    `power`, `enduro`, `wet-spec`) instead of the prior placeholder set
    (`balance`, `speed`, `grip`, `accel`, `heavy`, `light`).
  - `CarBaseStatsSchema.durability` widened from `unitInterval` to
    `positiveNumber` so heavy enduro cars (Bastion LM at 1.12) pass
    validation. Comment cites §23 as the source.
- Added `src/data/__tests__/cars-content.test.ts` (29 cases): catalogue
  size and id set, unique indexing, starter invariant, plus per-car
  schema validation, §23 balance match (within 1e-5), positive brake,
  and non-negative upgrade caps. All `it.each`-style so adding a car
  picks up coverage automatically once it is registered.
- Added `src/app/garage/cars/page.tsx`, a client component that loads
  the localStorage save, renders every car with its §22 stats, and lets
  the player either set the active car (owned cars) or buy one (gated
  by credits). Selling is intentionally out of scope; the §11 dot's
  edge case ("cannot sell active car") is satisfied by not exposing
  selling at all in this slice. Status messages surface save failures.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 105/105 (29 new + 76 existing). The schema test
  suite still rejects unknown classes; the §22 example car ("balance")
  remains valid under the new enum.
- `npm run build` succeeds; `/garage/cars` route ships at 17.6 kB.
- `grep` for U+2014 and U+2013 across all touched files returns nothing.
- Manual visual verification at `/garage/cars` deferred to a human run
  of `npm run dev`. The agent environment cannot drive a real browser
  so the persistence round-trip is covered only by unit tests of
  `loadSave`/`saveSave` plus the page logic. Logged here per RULE 8.

### Decisions and assumptions
- The prior `CarClassSchema` enum (`speed`, `grip`, `accel`, `heavy`,
  `light`) was a Phase 0 placeholder that did not match §11. Replacing
  it with the §11 classes is a schema correction, not a breaking change
  for shipped saves: only the §22 example used "balance" (still valid)
  and there are no live cars on disk yet.
- `durability` was previously `unitInterval` (0..1). §23 lists 1.12 for
  Bastion LM, so the schema was wrong. Widened to `positiveNumber` with
  a comment pointing at §23. No callers depended on the upper bound
  behaviour; the schemas test relied only on the unknown-class and
  negative-tier rejections, which still hold.
- Brake values are not in §23. Picked starter brakes between 27 and
  30, late-game brakes 31 to 33, scaling with grip and stability. If a
  later balance pass disagrees, only the JSONs need to change.
- `purchasePrice` is also absent from §23. Sparrow GT is 0 (starter
  invariant); the rest follow a starter (8k, 10k) vs late (28k, 32k,
  48k) split that gives the player a clear progression curve. Open to
  rebalance when the economy slice (§12) lands.
- Wet-spec is in the schema but no §11 example car declares it. Left
  the enum entry in for the niche-unlock car that §11 says exists
  ("Niche unlock") so a future content slice can drop a JSON in
  without re-touching the schema.
- Selling is deferred. The §11 dot lists "cannot sell active car" as
  an edge case; satisfied trivially by not exposing a sell button in
  this slice. Will be revisited with the upgrade UI.

### Followups created
- None. Selling, hangar visuals, and the §12 upgrade panel are all
  already covered by other ready dots.

### GDD edits
- None. The schema correction (CarClass enum + durability bound)
  brings the code into agreement with §11 and §23 as written; no GDD
  edits required.

---

## 2026-04-26: Slice: Pseudo-3D road renderer (Canvas2D, single straight track)

**GDD sections touched:** [§9](gdd/09-track-design.md), [§16](gdd/16-rendering-and-visual-design.md), [§21](gdd/21-technical-design-for-web-implementation.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/pseudo-3d-road-renderer` (off `chore/licence-files`), PR pending
**Status:** Implemented

### Done
- Added `src/road/constants.ts` pinning `ROAD_WIDTH`, `SEGMENT_LENGTH`,
  `DRAW_DISTANCE`, `FOV_DEGREES`, `CAMERA_HEIGHT`, `CAMERA_DEPTH`,
  `CURVATURE_SCALE`, stripe lengths, and `SPRITE_BASE_SCALE` per the values
  pinned in the research dot.
- Added `src/road/types.ts` with `Camera`, `Viewport`, `CompiledSegment`,
  and `Strip` types. Dependency-free so tests and the projector can import
  without pulling Canvas2D bindings.
- Added `src/road/trackCompiler.ts` exposing `compileTrack(track)` and
  `compileSegments(authored)` that expand variable-length authored
  segments into fixed `SEGMENT_LENGTH` blocks. `curve` and `grade` are
  pre-scaled into compiled units so the projector can sum dx and dy
  directly. NaN and Infinity in those fields are sanitized to 0 with a
  single warning per compile.
- Added `src/road/segmentProjector.ts` with a pure `project(segments,
  camera, viewport, options) -> Strip[]`. Implements the Gordon recipe:
  per-segment curve and grade accumulation, pinhole projection, and a
  near-to-far maxY clip that marks strips hidden behind a closer hill
  crest as not visible. Handles wrap-around for laps and caps
  drawDistance to totalSegments to avoid double-projecting tiny tracks.
- Added `src/render/pseudoRoadCanvas.ts` with `drawRoad(ctx, strips,
  viewport, options)`. Walks the strip list back-to-front and paints the
  sky band, alternating grass, rumble strips, road surface, and lane
  markings using filled trapezoids.
- Added `src/app/dev/road/page.tsx` (dev-only client component) at
  `/dev/road`. Mounts the renderer with a 1.2 km straight test track and
  a 60 m/s forward-moving camera. Surfaces fps, camera Z, and visible
  strip count for the manual visual check.
- Added unit tests:
  - `src/road/__tests__/trackCompiler.test.ts` (9 cases): empty input,
    `ceil(len / SEGMENT_LENGTH)` expansion, monotonic indices and
    worldZ, minimum-one-block guarantee, curve and grade scaling, NaN
    and Infinity sanitisation with single warning, ring-buffer total
    length, and authoredRef preservation.
  - `src/road/__tests__/segmentProjector.test.ts` (11 cases): empty
    list, degenerate viewport, monotonic screenY and screenW on a flat
    straight track, drift on a constant curve, mirrored sign behaviour
    on opposite curves, maxY cull on a sharp crest, lap wrap, drawDistance
    cap on tiny tracks, near-plane culling, and an analytical scale check.
- Wired `road` and `render` index re-exports.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm test` passes 76/76 (20 new + 56 existing).
- `npm run build` succeeds; `/dev/road` ships at 2.75 kB route size.
- `grep` for U+2014 and U+2013 across all touched files returns nothing.
- Manual visual verification at `/dev/road` deferred to a human run of
  `npm run dev`; the dot's "60 fps on a 2020-class laptop" check requires
  a real browser. Headless Vitest cannot render Canvas2D; this is logged
  here per RULE 8.

### Decisions and assumptions
- The maxY cull walks **near to far**, mirroring Gordon's racer.js
  pattern, not the back-to-front order originally described in the
  research dot. The two yield the same set of culled strips on flat
  ground (no cull), but only the near-to-far walk treats `maxY` as the
  smallest screenY seen so far, which is what the cull semantics
  actually require. Updated the comment in `segmentProjector.ts` to
  reflect the corrected order; the research dot is preserved as is.
- Strip pairing in the drawer uses `(strips[n-1], strips[n])` as
  `(near, far)`. The drawer walks the strip list far-to-near so closer
  strips paint on top of distant ones.
- `cameraOffsetWithinSegment` is computed inside the projector so the
  closest strip sits exactly at the camera position rather than snapping
  to the nearest segment boundary. Without this, the road would visibly
  jitter as the camera crossed each segment boundary.
- The strip array always preserves `drawDistance` slots even when the
  maxY cull marks some as not visible. Keeping array indices stable
  lets the drawer pair adjacent strips reliably without re-indexing
  after the cull.
- Sprite billboards, parallax background, and weather VFX are scoped
  out of this slice. Dot text confirms they belong to follow-up slices.

### Followups created
- None. Sprite atlas, background parallax, and authored multi-curve
  tracks are already tracked as separate ready dots.

### GDD edits
- None. Implementation matches the §16 visible characteristics, §21
  pipeline shape, and §9 road dimensions without GDD changes.

---

## 2026-04-26: Slice: Fixed-step simulation loop (§21 Game loop)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/fixed-step-loop` (off `feat/localstorage-save`), PR pending
**Status:** Implemented

### Done
- Added `src/game/loop.ts` with `startLoop`, `FIXED_STEP_SECONDS`,
  `FIXED_STEP_MS`, `MAX_ACCUMULATOR_MS`, plus `Scheduler`, `LoopOptions`,
  `LoopHandle`, and `LoopTickResult` types. Implements the §21 recipe:
  rAF-driven render, accumulator-based catch-up, fixed 60 Hz simulate
  callback, fractional alpha passed to render for blending. Spiral of
  death prevented by capping the accumulator at 250 ms (15 frames of
  catch-up max); excess time is reported as `droppedSteps` so callers
  can surface a hitch indicator if desired.
- Added `src/game/loop.test.ts` (11 cases) covering: first-frame origin
  (no sim, alpha=0), one tick per fixed step, exactly 6 ticks for
  100 ms elapsed, fractional remainder carry across frames, accumulator
  cap after a 5 s pause, custom max accumulator, rejection of a
  too-small max, negative-dt clamp, render-every-tick invariant,
  `stop()` idempotency and pending-handle cancel, and end-to-end
  scheduler-driven run.
- Added `src/app/dev/loop/page.tsx`, a client-only dev page at
  `/dev/loop` that reports running fps, sim tick count, render frame
  count, and the latest render alpha. Used for the manual
  tab-backgrounding check in §21.
- Wired `loop.ts` exports through `src/game/index.ts`.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 56/56 (11 new + 45 existing).
- `npm run build` succeeds; `/dev/loop` ships at 1.32 kB route size.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- The loop exposes a `tickFor(timestamp)` escape hatch on the returned
  handle so deterministic unit tests can drive frames without any
  timer or `vi.useFakeTimers()` setup. Production code never calls it
  directly; the scheduler does.
- Floating-point carry: `100 ms / (1000/60 ms) = 6.0` mathematically,
  but six successive subtractions of `1000/60` from `100` can leave
  the accumulator a few ULPs below zero, which would make the next
  step boundary cross a real-time fence late. A `1e-9 ms` epsilon in
  the loop's `>=` test pins exact-multiple cases to the expected step
  count without affecting any tick that lands more than a nanosecond
  off-boundary. Negative remainders are also clamped to zero.
- Cap chosen at 250 ms per the dot spec. With a 1/60 s step that
  buys 15 frames of catch-up, which keeps any single rAF tick under
  ~5 ms of sim work even on a slow integrated-GPU laptop. Customisable
  via `maxAccumulatorMs`; values below one fixed step are rejected as
  RangeError because they would deadlock the loop.
- `Scheduler` is its own one-method interface, not the DOM's
  `Window['requestAnimationFrame']` signature, to keep the loop
  testable from node and to allow future swap-out for a worker-driven
  loop without refactoring callers.
- Browser tab-backgrounding cannot be exercised from this agent's
  environment. The deterministic accumulator-cap test stands in for
  that scenario; manual browser verification via `/dev/loop` is left
  for the human reviewer.
- No `__tests__/` subdirectory was created. The repo's existing
  convention (per `raceState.test.ts`, `schemas.test.ts`,
  `save.test.ts`) co-locates `*.test.ts` next to the module under
  test. Followed that convention rather than the dot's suggested
  layout, per AGENTS.md RULE 9.

### Followups created
- None.

### GDD edits
- None.

---

## 2026-04-26: Slice: Versioned localStorage save/load (§21 Save system)

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md), [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/localstorage-save` (off `feat/data-schemas`), PR pending
**Status:** Implemented

### Done
- Added `src/persistence/save.ts` with `loadSave`, `saveSave`, `defaultSave`,
  and supporting types. Storage key `vibegear2:save:v<major>` is namespaced
  by the current schema major; corrupted or schema-invalid payloads get
  preserved under a `:backup` key for forensic recovery before the loader
  falls back to the default save.
- Added `src/persistence/migrations/index.ts` with `CURRENT_SAVE_VERSION = 1`
  and an empty migrations registry. The `migrate(input)` helper walks the
  registry from the input's declared version up to the current major,
  refuses to downgrade future-major saves, and validates the version field.
- Added `src/persistence/index.ts` barrel.
- Added `src/persistence/save.test.ts` (15 cases) covering: storage key
  shape, default save round-trip through the SaveGame schema, loadSave
  paths (no storage, missing key, valid load, corrupted JSON, schema
  invalid, getItem throws, future-major save), saveSave paths (success,
  invalid input refused, no storage, quota-exceeded, generic setItem
  error), and a save-then-load round-trip.
- Added `src/persistence/migrations/migrations.test.ts` (4 cases) covering
  identity v1 case, non-object input, invalid version field, and refusal
  to downgrade.

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 45/45 (3 race state + 23 schemas + 15 save + 4
  migrations).
- `npm run build` succeeds.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Every failure mode is non-fatal. The dot spec says "fall back to default
  save (no persistence) with warning" for unavailable storage, "log and
  use default save, do not crash" for corrupted JSON, and to preserve raw
  under a backup key on schema validation failure. Implemented exactly
  that. Quota-exceeded is surfaced as a typed error so the UI can decide
  whether to retry, prompt the player, or shrink the save.
- Quota detection cross-checks `error.name`
  (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`) and the legacy
  numeric `code` (22, 1014). Covers Chrome, Safari, and old Firefox.
- `defaultSave()` ships with credits 0, the starter `sparrow-gt` already
  owned and active, and a zeroed upgrade row for that car. Phase 2 garage
  flow will replace this with a "create profile" wizard, but the data
  needs to validate today so that loadSave can return a usable SaveGame
  on first run.
- The `SaveIO` interface lets every public function accept an optional
  `storage` and `logger`, defaulting to globalThis.localStorage and
  console.warn. This keeps the module testable without jsdom (the unit
  tests use a hand-rolled in-memory Storage shim) and lets future SSR
  paths inject `null`.
- `migrate` validates that the input is a plain object with a positive
  integer version. v1 takes the identity path; v2+ migrations are
  registered as `migrations[fromVersion]` returning the next-version
  shape. Skipping a step is a thrown error, not a silent identity, so
  forgotten migrations fail loudly.
- Did not add the Playwright reload-survives-save test the dot spec
  mentions. The save module has no UI bindings yet (no garage screen, no
  options screen), so there is nothing meaningful to drive in a browser.
  Filed as a followup to revisit when the garage flow lands.

### Followups created
- F-004 Add a Playwright e2e test that drives the garage UI to mutate a
  save and asserts persistence across reload. Open until the Phase 2
  garage flow exists; tracked in `docs/FOLLOWUPS.md`.

### GDD edits
- None.

---

## 2026-04-26: Slice: Data schemas as Zod validators and TS types (§22)

**GDD sections touched:** [§22](gdd/22-data-schemas.md)
**Branch / PR:** `feat/data-schemas` (off `feat/scaffold-next-app`), PR pending
**Status:** Implemented

### Done
- Added `src/data/schemas.ts` with Zod runtime validators and inferred
  TypeScript types for every JSON contract in §22: `Track`, `Car`,
  `Upgrade`, `Championship`, `AIDriver`, `SaveGame`, plus the supporting
  enums (`WeatherOption`, `CarClass`, `UpgradeCategory`, `DifficultyPreset`,
  `AIArchetype`, `SpeedUnit`) and nested record schemas (`TrackSegment`,
  `TrackCheckpoint`, `CarBaseStats`, `CarUpgradeCaps`, `AIWeatherSkill`,
  `AINitroUsage`, `SaveGameGarage`, `SaveGameSettings`,
  `SaveGameProgress`, `SaveGameRecord`).
- Added a barrel at `src/data/index.ts` so consumers can
  `import { TrackSchema, type Track } from "@/data"`.
- Added six fixture files under `src/data/examples/` copied verbatim from the
  §22 examples (track, car, upgrade, championship, aiDriver, saveGame).
- Added `src/data/schemas.test.ts` with 23 Vitest cases: each schema accepts
  its §22 example and rejects at least three deliberately broken variants
  (empty segments, negative numerics, unknown enum values, missing
  required fields).

### Verified
- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test` passes 26/26 (3 pre-existing + 23 new).
- `npm run build` succeeds.
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Slug format permits lowercase alphanumerics, hyphens, and underscores.
  §22's AI driver IDs use snake_case (`ai_cleanline_01`); track IDs use a
  `tour-id/track-id` path. The regex accepts both.
- Picked enum sets that are conservative supersets of what §22 shows
  (e.g. `WeatherOption` includes `rain`, `heavy_rain`, `fog`, `snow`,
  `night` even though the example only uses `clear`, `light_rain`, `dusk`).
  These are forward-compatible with §14 weather and §22 likely future
  expansion. If the GDD ever pins a different set, narrow here.
- `UpgradeEffectsSchema` uses optional numeric fields with a refine that
  requires at least one declared effect. §22 shows two effects; the schema
  allows any subset of the eight stat keys so future upgrades can target
  brake or stability.
- `CarUpgradeCaps` and `SaveGame.garage.installedUpgrades.<carId>` reuse
  the same eight-category shape because §12 and §22 both list the same
  categories. Consolidated into one schema constant generated from
  `UpgradeCategorySchema.options`.
- `SaveGameGarage.installedUpgrades` and `SaveGame.records` both use
  `z.record(slug, ...)` to allow any car ID or track ID as a key. Stronger
  cross-record validation (e.g. record key must appear in `ownedCars`)
  belongs at the load-time wrapper, not inside the leaf schema.
- Did not add JSON Schema export. Phase 0 only requires TS types + Zod
  runtime validators per the dot spec. Defer to a content-pipeline slice if
  authoring tools need it.

### Followups created
- None.

### GDD edits
- None. The §22 examples round-trip without modification.

---

## 2026-04-26: Slice: Scaffold Next.js + TypeScript app shell

**GDD sections touched:** [§21](gdd/21-technical-design-for-web-implementation.md)
**Branch / PR:** `feat/scaffold-next-app`, PR pending
**Status:** Implemented

### Done
- Stood up the Next.js 15 (App Router) + React 18 + TypeScript 5 strict
  project skeleton at the repo root: `package.json`, `tsconfig.json` with
  strict + `noUncheckedIndexedAccess` + `@/*` path alias, `next.config.mjs`
  with `outputFileTracingRoot` and typed routes, `.eslintrc.json` extending
  `next/core-web-vitals` and `next/typescript`, `.gitignore` covering the
  Next/Node/Playwright artefact paths plus `.dots/`.
- Added the App Router skeleton: `src/app/layout.tsx`, `src/app/page.tsx`
  (title screen with disabled menu placeholders for Start Race, Garage,
  Options, plus a `data-testid="game-title"` hook for the upcoming Playwright
  smoke), `src/app/globals.css`, and `src/app/page.module.css`.
- Created the Phase 0 stub layout for the runtime modules under §21's
  recommended structure: `src/game/`, `src/road/`, `src/render/` each with an
  `index.ts` barrel referencing §21. Added `src/game/raceState.ts` with a
  typed `createRaceState` constructor and three Vitest unit tests
  (`raceState.test.ts`) so the test harness exercises real code from day one.
- Added Vitest 2 unit harness via `vitest.config.ts` (node environment,
  `src/**/*.test.ts` discovery, `@/*` alias mirror, v8 coverage), and npm
  scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`,
  `verify` (lint + typecheck + test).

### Verified
- `npm install` succeeds (436 packages, no peer-dep failures).
- `npm run lint` passes with zero warnings.
- `npm run typecheck` passes (`tsc --noEmit`, strict).
- `npm run test` runs 3 unit tests, all green.
- `npm run build` produces an optimised production build, prerenders `/`
  statically (102 kB First Load JS).
- `grep` for U+2014 and U+2013 across new files returns nothing.

### Decisions and assumptions
- Resolved Q-001: §21 is fully authored, so the slice adopts the recommended
  layered architecture verbatim. Picked Next.js 15 (latest stable App Router)
  rather than 14 because §21 specifies "Next.js" without pinning a major and
  the canary tooling still works under 15.
- Picked React 18 over React 19 deliberately: §21 says "Reuse VibeRacer
  patterns" and React 18 is the current LTS-equivalent for Next.js + Vitest +
  jsdom; revisit when Phase 1 needs concurrent features.
- Deferred Playwright e2e harness to its own slice (`implement: add
  Playwright e2e harness and title-screen smoke`) so this slice stays
  PR-sized.
- Deferred CI / auto-deploy to its own slice (`implement: GitHub Actions CI
  + auto-deploy`), still blocked by Q-003.
- Excluded `.dots/` from version control: the dots task tracker is a
  per-developer working artefact, not a build input.
- Marked the title-screen menu items disabled rather than wired-up: the
  routes do not exist yet, and Phase 0 only owes a title screen.

### Followups created
- None new. F-001 marked `done` (sections 18 to 28 already exist; the
  followup was based on a stale assumption). F-002 advanced to `in-progress`:
  remaining slices are Playwright smoke and GitHub Actions CI.

### GDD edits
- None.

---

## 2026-04-26 — Slice: Bootstrap implementation plan and working agreement

**GDD sections touched:** none (meta)
**Branch / PR:** `claude/gdd-implementation-plan-Z0cpN`, PR pending
**Status:** Implemented

### Done
- Added `docs/IMPLEMENTATION_PLAN.md` describing phases, the per-loop
  workflow, slice selection rules, definitions of done, and stopping
  conditions.
- Added `docs/WORKING_AGREEMENT.md` describing branching, commits, PRs,
  auto-deploy expectations, verification rules, clarification protocol, and
  risky-action gates.
- Seeded `docs/PROGRESS_LOG.md`, `docs/OPEN_QUESTIONS.md`, and
  `docs/FOLLOWUPS.md` so subsequent loops have a place to write.

### Verified
- Manual review of the four documents for internal consistency and against
  `GDD.md` section list.

### Decisions and assumptions
- Treated `GDD.docx` as a historical artefact; Markdown is canonical.
- Assumed Next.js + TypeScript + Canvas2D stack as implied by
  `01-title-and-high-concept.md` and `21-technical-design-for-web-implementation.md`
  (the latter is not yet authored — flagged as Q-001).
- Chose squash-merge as the default merge strategy, reversible by dev request.

### Followups created
- F-001 Author the eleven missing GDD sections (18–28) before Phase 0 can
  close.
- F-002 Stand up the Next.js + TypeScript project skeleton with CI and a
  deploy target.
- F-003 Wire an auto-deploy pipeline from `main`.

### GDD edits
- None.
