/**
 * Per-tick ghost-car driver.
 *
 * Pure helper that wraps the §6 Time Trial ghost-overlay pipeline behind a
 * single `tick(...)` call. Composes three modules that already exist:
 *
 *   - `createPlayer(replay)` from `./ghost.ts` walks the recorded `Input`
 *     deltas back into a per-tick stream.
 *   - `step(...)` from `./physics.ts` advances a separate `CarState` from
 *     the recorded input. The same physics function the live car uses, so
 *     the ghost's path matches the recorded run bit-for-bit.
 *   - `projectGhostCar(...)` from `@/road/segmentProjector` projects the
 *     ghost's `(z, x)` to the screen-space prop `pseudoRoadCanvas.drawRoad`
 *     consumes via its `ghostCar` field.
 *
 * Why a separate helper rather than inlining at the route:
 *
 *   - The Time Trial route already has plenty to wire (recorder lifecycle,
 *     PB selection, save persistence, results handoff). Lifting the
 *     per-tick ghost pipeline into a pure helper keeps the route shell a
 *     thin glue layer rather than a place that re-derives camera /
 *     viewport / step plumbing on every frame.
 *   - The same helper is reusable for the dev-page debug surface (a
 *     deterministic playback against a synthetic replay), the headless
 *     replay-equivalence test in `rng-integration.test.ts` once F-024
 *     lands, and any future "rival ghost" overlay (e.g. friend's PB)
 *     without re-implementing the projection pair.
 *   - Composition stays testable: feeding the driver a synthetic replay
 *     plus a synthetic camera + viewport covers every transition without
 *     standing up a `RaceSessionState` or a real track compile.
 *
 * Determinism contract:
 *
 *   - Two drivers fed the same `Replay`, the same physics stats / track
 *     context / dt, and the same per-tick camera produce the same per-tick
 *     `GhostOverlay`. Bit-exact, not "within tolerance": both physics and
 *     replay playback are deterministic by AGENTS.md RULE 8, and the
 *     projector is a pure function.
 *   - A `null` replay (no PB recorded yet) is handled at the constructor:
 *     the returned driver hands out hidden overlays from every `tick(...)`
 *     call so the route can wire it unconditionally without an extra
 *     guard. Same for a replay with a `mismatchReason` (format / physics /
 *     fixed-step version drift); the driver never throws on the per-tick
 *     path.
 *
 * Out of scope (filed in FOLLOWUPS):
 *
 *   - Atlas-frame draw variant. The driver returns the screen prop the
 *     placeholder rect drawer consumes; the atlas-frame upgrade lands in
 *     the same slice that wires `LoadedAtlas` through the renderer for
 *     the live car.
 *   - Sub-stream RNG threading. The recorded replay was deterministic at
 *     record time; playback is input-driven and does not draw RNG, so the
 *     driver does not need an RNG sub-stream. F-024 covers the live AI /
 *     hazard / weather subsystems instead.
 */

import type { Camera, CompiledSegment, Viewport } from "@/road/types";
import {
  projectGhostCar,
  type GhostCarProjection,
  type ProjectorOptions,
} from "@/road/segmentProjector";

import type { CarBaseStats } from "@/data/schemas";
import { createPlayer, type Player, type Replay, type ReplayRejectReason } from "./ghost";
import {
  DEFAULT_TRACK_CONTEXT,
  INITIAL_CAR_STATE,
  step,
  type CarState,
  type StepOptions,
  type TrackContext,
} from "./physics";

/**
 * §6 default alpha for the ghost overlay. Mirrors the value that lives
 * on the drawer side as `GHOST_CAR_DEFAULT_ALPHA` in
 * `src/render/pseudoRoadCanvas.ts`. Duplicated here (rather than
 * imported) to keep the per-layer dependency direction one-way:
 * `src/render/` already imports from `src/game/` indirectly via the
 * page glue layer, and adding a `game -> render` import would make the
 * dependency graph cyclic. The two constants must move together; if
 * one updates, update the other in the same slice.
 */
const DEFAULT_GHOST_ALPHA = 0.5;

/**
 * Construction options for `createGhostDriver`. The driver owns:
 *
 *   - The `replay` it plays back (or `null` for "no PB recorded yet").
 *   - The `stats` and `trackContext` that drive the per-tick `step` call.
 *     These should match what the recording was made under so the
 *     replayed path matches the live car's path; mismatches manifest as
 *     visible drift between live and ghost on the same recorded inputs.
 *   - An optional `initial` `CarState`. Defaults to `INITIAL_CAR_STATE`,
 *     matching how the live car starts on the line. Pinned to the
 *     `TrackSpawn` lane offset by the route slice when needed.
 *   - Optional `stepOptions`. The live car's per-tick step consumes draft
 *     bonuses, damage scalars, and difficulty preset scalars; the ghost
 *     by default ignores those (a clean recorded replay does not mutate
 *     under draft / damage / preset because the recorded inputs already
 *     bake in the player's response). The hook is here so a future
 *     "ghost recorded under hard preset, played back under easy" debug
 *     mode can opt in.
 */
export interface GhostDriverOptions {
  replay: Replay | null;
  stats: Readonly<CarBaseStats>;
  trackContext?: Readonly<TrackContext>;
  initial?: Readonly<Partial<CarState>>;
  stepOptions?: Readonly<StepOptions>;
  /**
   * Override the §6 default alpha. The drawer clamps to `[0, 1]` so an
   * out-of-band value collapses to a hidden draw rather than throwing;
   * still, callers should keep this in `[0, 1]`.
   */
  alpha?: number;
  /**
   * Override the §6 default fill colour. Forwarded verbatim to the
   * drawer's `ghostCar.fill` field; `undefined` means "use the §6 blue
   * default" (`GHOST_CAR_DEFAULT_FILL`).
   */
  fill?: string;
}

/**
 * Per-tick context the driver needs from the call site. Mirrors the
 * subset `step` reads from a `RaceSessionState`: the camera that the live
 * road draw paid for, the viewport, and the elapsed `tick` index since
 * the green light. Carrying the camera here (rather than a session
 * reference) lets the helper run against a synthetic camera in tests.
 */
export interface GhostTickContext {
  /** Race-session tick counter post-step. Same clock the recorder used. */
  tick: number;
  /** Fixed-step duration in seconds the live `step` consumed. */
  dt: number;
  camera: Readonly<Camera>;
  viewport: Readonly<Viewport>;
  /**
   * Compiled segments from `track.compiled.segments`. Held here rather
   * than at construction so the driver can be reused across tracks (one
   * driver per session); the route already holds a `Track` reference per
   * mount, so the per-tick read is free.
   */
  segments: readonly CompiledSegment[];
  /** Optional projector overrides forwarded to `projectGhostCar`. */
  projector?: ProjectorOptions;
}

/**
 * Drop-in shape for `pseudoRoadCanvas.drawRoad`'s `ghostCar` prop. The
 * driver returns this shape directly so the call site can wire
 *
 *     drawRoad(ctx, strips, viewport, { ghostCar: driver.tick(ctx) })
 *
 * without restating the projection pair. `null` means "skip the prop"
 * (no PB recorded, ghost finished, ghost off-screen, version mismatch).
 */
export type GhostOverlay = {
  screenX: number;
  screenY: number;
  screenW: number;
  alpha: number;
  fill?: string;
} | null;

/**
 * Live driver. Holds:
 *
 *   - The active `Player` (or `null` for a missing / mismatched replay).
 *   - The running `CarState` advanced by per-tick `step` calls.
 *   - Latched `finished` / `mismatchReason` flags lifted from the player
 *     so the call site can read them without holding a player reference.
 */
export interface GhostDriver {
  /**
   * Advance one fixed-step tick. Pulls the next recorded input via
   * `player.readNext(tick)`, advances the internal `CarState` via
   * `step(...)`, projects to screen via `projectGhostCar(...)`, and
   * returns the drop-in `GhostOverlay` shape (or `null` to skip).
   *
   * Returns `null` when:
   *
   *   - The replay was missing at construction time (no PB).
   *   - The replay was rejected at construction (format / physics /
   *     fixed-step version drift). `mismatchReason` reports which.
   *   - The recorded run finished. The live car keeps racing; the ghost
   *     simply stops being drawn after its recorded final tick.
   *   - The projected ghost is behind the camera, past the draw
   *     distance, or fed a degenerate viewport.
   *
   * Idempotent on a finished or null-replay driver: subsequent calls
   * remain `null` without side effects.
   */
  tick(context: GhostTickContext): GhostOverlay;
  /**
   * Current ghost car state. `null` while the driver is in a
   * "no playback" path (missing or mismatched replay). Useful for
   * test assertions and the eventual debug HUD.
   */
  readonly carState: Readonly<CarState> | null;
  /** True once the recorded replay has been fully consumed. Latches. */
  readonly finished: boolean;
  /**
   * Non-null when the replay was rejected at construction. The driver's
   * `tick` returns `null` from every call so the consumer's "ghost car"
   * branch becomes a no-op without a separate guard.
   */
  readonly mismatchReason: ReplayRejectReason | null;
  /**
   * The most recent projection result, or `null` when none has been
   * computed yet (or the driver is in a no-playback path). The route
   * does not need this, but tests use it to inspect `worldX` / `scale`
   * fields the overlay shape strips for the drawer.
   */
  readonly lastProjection: Readonly<GhostCarProjection> | null;
}

/**
 * Build a fresh driver. The driver is silent on a missing replay (a fresh
 * Time Trial run with no stored ghost) and on a version-mismatched replay
 * (a save migrated forward past the recording's stamp); both paths return
 * `null` from every `tick(...)` call and surface the reason via
 * `mismatchReason` (`null` for a clean missing-replay path).
 */
export function createGhostDriver(options: GhostDriverOptions): GhostDriver {
  const trackContext = options.trackContext ?? DEFAULT_TRACK_CONTEXT;
  const stepOptions = options.stepOptions;
  const alpha =
    typeof options.alpha === "number" && Number.isFinite(options.alpha)
      ? options.alpha
      : DEFAULT_GHOST_ALPHA;
  const fill = options.fill;

  let player: Player | null = null;
  let mismatchReason: ReplayRejectReason | null = null;
  let car: CarState | null = null;
  let finishedFlag = false;
  let lastProjection: GhostCarProjection | null = null;

  if (options.replay !== null) {
    player = createPlayer(options.replay);
    mismatchReason = player.mismatchReason;
    if (mismatchReason !== null) {
      // The player's `readNext` already short-circuits on a mismatch, but
      // we mirror the latched state here so the route can read it without
      // holding a player reference.
      finishedFlag = true;
      player = null;
    } else {
      car = { ...INITIAL_CAR_STATE, ...(options.initial ?? {}) };
    }
  }

  function tick(context: GhostTickContext): GhostOverlay {
    if (player === null || car === null) {
      lastProjection = null;
      return null;
    }
    if (finishedFlag) {
      lastProjection = null;
      return null;
    }

    const recordedInput = player.readNext(context.tick);
    if (recordedInput === null) {
      // `readNext` only returns `null` on a rejected replay; we already
      // gated that path above. Defence in depth: keep the ghost hidden.
      lastProjection = null;
      finishedFlag = true;
      return null;
    }

    car = step(car, recordedInput, options.stats, trackContext, context.dt, stepOptions);

    if (player.finished) {
      // Latch the finished flag the same tick the player handed out the
      // last recorded input. The live car keeps racing; the ghost stops
      // being drawn after its recorded final tick.
      finishedFlag = true;
    }

    const projection = projectGhostCar(
      context.segments,
      context.camera,
      context.viewport,
      car.z,
      car.x,
      context.projector,
    );
    lastProjection = projection;

    if (!projection.visible) {
      return null;
    }

    return {
      screenX: projection.screenX,
      screenY: projection.screenY,
      screenW: projection.screenW,
      alpha,
      ...(fill !== undefined ? { fill } : {}),
    };
  }

  return {
    tick,
    get carState() {
      return car;
    },
    get finished() {
      return finishedFlag;
    },
    get mismatchReason() {
      return mismatchReason;
    },
    get lastProjection() {
      return lastProjection;
    },
  };
}
