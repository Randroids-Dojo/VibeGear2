/**
 * Zod runtime validators and inferred TypeScript types for every data shape
 * defined in docs/gdd/22-data-schemas.md.
 *
 * Single import surface for all data-driven content: tracks, cars, upgrades,
 * championships, AI drivers, and save-games. Phase 0 task per
 * docs/IMPLEMENTATION_PLAN.md.
 *
 * When the GDD adds, removes, or renames fields, update both this module
 * and the matching example fixture under `src/data/examples/`. Validation
 * failures are silent in production builds, so prefer fail-fast at the
 * point of load via `safeParse(...)`.
 */

import { z } from "zod";

// Shared primitives ---------------------------------------------------------

/**
 * IDs across the GDD use lowercase alphanumerics with hyphens, with underscores
 * permitted (AI driver IDs in §22 use snake_case). Slugs may also be path-like
 * (`tour-id/track-id`) for nested references.
 */
const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/u, {
    message: "id must be a slug or slug/slug path (lowercase, digits, hyphens, underscores)",
  });

const nonNegInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();
const positiveNumber = z.number().positive();
const unitInterval = z.number().min(0).max(1);

// Track ---------------------------------------------------------------------

export const WeatherOptionSchema = z.enum([
  "clear",
  "light_rain",
  "rain",
  "heavy_rain",
  "fog",
  "snow",
  "dusk",
  "night",
]);
export type WeatherOption = z.infer<typeof WeatherOptionSchema>;

export const TrackSegmentSchema = z.object({
  len: positiveNumber,
  curve: z.number().min(-1).max(1),
  grade: z.number().min(-0.3).max(0.3),
  roadsideLeft: z.string().min(1),
  roadsideRight: z.string().min(1),
  hazards: z.array(z.string().min(1)),
});
export type TrackSegment = z.infer<typeof TrackSegmentSchema>;

export const TrackCheckpointSchema = z.object({
  segmentIndex: nonNegInt,
  label: z.string().min(1),
});
export type TrackCheckpoint = z.infer<typeof TrackCheckpointSchema>;

export const TrackSpawnSchema = z.object({
  gridSlots: positiveInt,
});
export type TrackSpawn = z.infer<typeof TrackSpawnSchema>;

/**
 * Optional author override for the minimap polyline. When present the
 * track compiler honours these footprint coordinates verbatim instead of
 * integrating per-segment headings. Used for hand-authored maps where
 * the heading-integration projection looks distorted (open-ended tracks,
 * intentional kinks). Per `docs/gdd/22-data-schemas.md` Track data model
 * "minimap points".
 */
export const MinimapPointAuthoredSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type MinimapPointAuthored = z.infer<typeof MinimapPointAuthoredSchema>;

export const TrackSchema = z.object({
  id: slug,
  name: z.string().min(1),
  tourId: slug,
  author: z.string().min(1),
  version: positiveInt,
  lengthMeters: positiveNumber,
  laps: positiveInt,
  laneCount: positiveInt,
  weatherOptions: z.array(WeatherOptionSchema).min(1),
  difficulty: z.number().int().min(1).max(5),
  segments: z.array(TrackSegmentSchema).min(1),
  checkpoints: z.array(TrackCheckpointSchema),
  spawn: TrackSpawnSchema,
  /**
   * Optional hand-authored minimap polyline. Length-zero arrays are
   * rejected so callers can detect "absent" with a simple `=== undefined`
   * check. When supplied, length must be at least 2 so the polyline has
   * a well-defined direction.
   */
  minimapPoints: z.array(MinimapPointAuthoredSchema).min(2).optional(),
});
export type Track = z.infer<typeof TrackSchema>;

// Car -----------------------------------------------------------------------

/**
 * Car classes per docs/gdd/11-cars-and-stats.md "Car classes" table.
 *
 * - sprint: beginner-friendly grip-and-recovery archetype
 * - balance: all-purpose, no dominant edge
 * - power: top speed + nitro scaling, harder in weather
 * - enduro: durability and stable late race
 * - wet-spec: rain and snow specialist, weak in dry finals
 */
export const CarClassSchema = z.enum([
  "sprint",
  "balance",
  "power",
  "enduro",
  "wet-spec",
]);
export type CarClass = z.infer<typeof CarClassSchema>;

/**
 * Base car stats. All values are positive multipliers or absolute speeds
 * per docs/gdd/23-balancing-tables.md "Core car balance sheet". Durability
 * is a multiplier, not a percentage, so values above 1.0 are valid for the
 * heavy-class entries (Bastion LM at 1.12).
 */
export const CarBaseStatsSchema = z.object({
  topSpeed: positiveNumber,
  accel: positiveNumber,
  brake: positiveNumber,
  gripDry: positiveNumber,
  gripWet: positiveNumber,
  stability: positiveNumber,
  durability: positiveNumber,
  nitroEfficiency: positiveNumber,
});
export type CarBaseStats = z.infer<typeof CarBaseStatsSchema>;

export const UpgradeCategorySchema = z.enum([
  "engine",
  "gearbox",
  "dryTires",
  "wetTires",
  "nitro",
  "armor",
  "cooling",
  "aero",
]);
export type UpgradeCategory = z.infer<typeof UpgradeCategorySchema>;

const upgradeCapsObject = z.object(
  Object.fromEntries(
    UpgradeCategorySchema.options.map((cat) => [cat, nonNegInt]),
  ) as Record<UpgradeCategory, typeof nonNegInt>,
);
export const CarUpgradeCapsSchema = upgradeCapsObject;
export type CarUpgradeCaps = z.infer<typeof CarUpgradeCapsSchema>;

export const CarVisualProfileSchema = z.object({
  spriteSet: z.string().min(1),
  paletteSet: z.string().min(1),
});
export type CarVisualProfile = z.infer<typeof CarVisualProfileSchema>;

export const CarSchema = z.object({
  id: slug,
  name: z.string().min(1),
  class: CarClassSchema,
  purchasePrice: nonNegInt,
  repairFactor: positiveNumber,
  baseStats: CarBaseStatsSchema,
  upgradeCaps: CarUpgradeCapsSchema,
  visualProfile: CarVisualProfileSchema,
});
export type Car = z.infer<typeof CarSchema>;

// Upgrade -------------------------------------------------------------------

const upgradeEffectKeys = [
  "topSpeed",
  "accel",
  "brake",
  "gripDry",
  "gripWet",
  "stability",
  "durability",
  "nitroEfficiency",
] as const;

const UpgradeEffectsSchema = z
  .object(
    Object.fromEntries(
      upgradeEffectKeys.map((k) => [k, z.number().optional()]),
    ) as Record<(typeof upgradeEffectKeys)[number], z.ZodOptional<z.ZodNumber>>,
  )
  .refine((effects) => Object.values(effects).some((v) => v !== undefined), {
    message: "upgrade must declare at least one numeric effect",
  });

export const UpgradeSchema = z.object({
  id: slug,
  category: UpgradeCategorySchema,
  tier: z.number().int().min(1).max(10),
  name: z.string().min(1),
  cost: nonNegInt,
  effects: UpgradeEffectsSchema,
});
export type Upgrade = z.infer<typeof UpgradeSchema>;

// Championship --------------------------------------------------------------

export const DifficultyPresetSchema = z.enum([
  "novice",
  "easy",
  "normal",
  "hard",
  "extreme",
]);
export type DifficultyPreset = z.infer<typeof DifficultyPresetSchema>;

export const ChampionshipTourSchema = z.object({
  id: slug,
  requiredStanding: positiveInt,
  tracks: z.array(slug).min(1),
});
export type ChampionshipTour = z.infer<typeof ChampionshipTourSchema>;

export const ChampionshipSchema = z.object({
  id: slug,
  name: z.string().min(1),
  difficultyPreset: DifficultyPresetSchema,
  tours: z.array(ChampionshipTourSchema).min(1),
});
export type Championship = z.infer<typeof ChampionshipSchema>;

// AI driver -----------------------------------------------------------------

export const AIArchetypeSchema = z.enum([
  "clean_line",
  "aggressive",
  "defender",
  "wet_specialist",
  "nitro_burst",
  "endurance",
]);
export type AIArchetype = z.infer<typeof AIArchetypeSchema>;

export const AIWeatherSkillSchema = z.object({
  clear: positiveNumber,
  rain: positiveNumber,
  fog: positiveNumber,
  snow: positiveNumber,
});
export type AIWeatherSkill = z.infer<typeof AIWeatherSkillSchema>;

export const AINitroUsageSchema = z.object({
  launchBias: unitInterval,
  straightBias: unitInterval,
  panicBias: unitInterval,
});
export type AINitroUsage = z.infer<typeof AINitroUsageSchema>;

export const AIDriverSchema = z.object({
  id: slug,
  displayName: z.string().min(1),
  archetype: AIArchetypeSchema,
  paceScalar: positiveNumber,
  mistakeRate: unitInterval,
  aggression: unitInterval,
  weatherSkill: AIWeatherSkillSchema,
  nitroUsage: AINitroUsageSchema,
});
export type AIDriver = z.infer<typeof AIDriverSchema>;

// Sprite atlas --------------------------------------------------------------

/**
 * Anchor offset relative to a frame's top-left, normalised in [0, 1].
 * Defaults to `{ x: 0.5, y: 1 }` (foot of sprite) when omitted by the
 * loader, but the schema accepts any in-bounds value so atlases can pin a
 * different pivot per frame (e.g. centre for trackside billboards).
 */
const AtlasAnchorSchema = z.object({
  x: unitInterval,
  y: unitInterval,
});

/**
 * Single source rect inside the atlas image. Width and height must be
 * positive so the runtime never has to defend against zero-size blits.
 */
export const AtlasFrameSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  w: positiveNumber,
  h: positiveNumber,
  anchor: AtlasAnchorSchema.optional(),
});
export type AtlasFrame = z.infer<typeof AtlasFrameSchema>;

/**
 * Atlas metadata. `image` is a path relative to `public/` (resolved as
 * `/<image>` at runtime). `sprites` maps a sprite id to an ordered frame
 * list; frame 0 is the canonical "facing camera" frame per §17.
 *
 * The sprites map and every frame array are required to be non-empty so
 * callers can index `[0]` without bounds checks.
 */
export const AtlasMetaSchema = z.object({
  image: z.string().min(1),
  width: positiveInt,
  height: positiveInt,
  sprites: z
    .record(z.string().min(1), z.array(AtlasFrameSchema).min(1))
    .refine((value) => Object.keys(value).length > 0, {
      message: "atlas must declare at least one sprite",
    }),
});
export type AtlasMeta = z.infer<typeof AtlasMetaSchema>;

// Save-game -----------------------------------------------------------------

export const SpeedUnitSchema = z.enum(["kph", "mph"]);
export type SpeedUnit = z.infer<typeof SpeedUnitSchema>;

/**
 * §19 'Accessibility controls' bundle. The original v1 trio
 * (`steeringAssist`, `autoNitro`, `weatherVisualReduction`) keeps its
 * required shape so existing saves and the example fixture continue to
 * load unchanged. The remaining §19 assists land as optional fields with
 * a documented default (treated as `false` when absent) so adding the
 * new flags is a purely additive migration.
 *
 * Field semantics:
 * - `steeringAssist`: legacy compound flag retained for backward compat.
 *   Currently ignored by the runtime in favour of the finer-grained
 *   `steeringSmoothing` knob below; kept on the schema so a v1 save
 *   that toggled it still validates.
 * - `autoNitro`: when true the AI fires nitro on the player's behalf at
 *   straight-line opportunities. Wired by the nitro-assist follow-up
 *   slice; the assists pure module surfaces the flag for future
 *   consumers without yet acting on it.
 * - `weatherVisualReduction`: visual-only weather mode. When true, the
 *   physics layer ignores weather grip penalties; the renderer keeps
 *   drawing rain / snow at reduced intensity.
 * - `autoAccelerate`: throttle is held at 1 unless the player is
 *   actively braking. Brake input always wins.
 * - `brakeAssist`: scales brake input upward when held during a known
 *   high-speed corner approach. Off by default.
 * - `steeringSmoothing`: applies a low-pass filter to the steer axis to
 *   damp twitchy keyboard inputs. Off by default; on for the
 *   reduced-mobility preset.
 * - `nitroToggleMode`: when true, a single tap on the nitro key toggles
 *   nitro on / off rather than the default hold-to-burn semantics.
 * - `reducedSimultaneousInput`: when true, only one of the steer / accel
 *   / brake / nitro / handbrake actions is honoured per tick, picked by
 *   a stable priority ladder. Helps single-switch users.
 */
const ASSIST_FIELD_KEYS = [
  "steeringAssist",
  "autoNitro",
  "weatherVisualReduction",
  "autoAccelerate",
  "brakeAssist",
  "steeringSmoothing",
  "nitroToggleMode",
  "reducedSimultaneousInput",
] as const;

export const AssistSettingsSchema = z.object({
  steeringAssist: z.boolean(),
  autoNitro: z.boolean(),
  weatherVisualReduction: z.boolean(),
  autoAccelerate: z.boolean().optional(),
  brakeAssist: z.boolean().optional(),
  steeringSmoothing: z.boolean().optional(),
  nitroToggleMode: z.boolean().optional(),
  reducedSimultaneousInput: z.boolean().optional(),
});
export type AssistSettings = z.infer<typeof AssistSettingsSchema>;
export type AssistFieldKey = (typeof ASSIST_FIELD_KEYS)[number];
export const ASSIST_FIELDS: ReadonlyArray<AssistFieldKey> = ASSIST_FIELD_KEYS;

/**
 * Player-facing difficulty preset, picked in the /options Difficulty pane
 * (GDD §15 'Difficulty tiers' table). Distinct from the championship-side
 * `DifficultyPresetSchema` enum: the championship value is fixed at
 * tour-enter time and may use a wider taxonomy (novice through extreme),
 * while the save-game preset is the player's current default for new
 * tours and quick-race sessions and matches the §15 four-tier ladder
 * exactly. Master is unlock-gated per §15 (one championship completed
 * at Hard); the gate is enforced at the UI layer, not by the schema.
 */
export const PlayerDifficultyPresetSchema = z.enum([
  "easy",
  "normal",
  "hard",
  "master",
]);
export type PlayerDifficultyPreset = z.infer<
  typeof PlayerDifficultyPresetSchema
>;

/**
 * Player-facing transmission mode per GDD §10 "Gear shifting" and §19
 * "Keyboard layout" (E / Q for keyboard, RB / LB on pad). Automatic is
 * the default; manual is an opt-in expert mode that earns a small (under
 * 5%) accel advantage at the optimal shift point.
 */
export const TransmissionModeSchema = z.enum(["auto", "manual"]);
export type TransmissionModePersisted = z.infer<typeof TransmissionModeSchema>;

export const SaveGameSettingsSchema = z.object({
  displaySpeedUnit: SpeedUnitSchema,
  assists: AssistSettingsSchema,
  /**
   * Optional so v1 saves written before this field was added still load.
   * `defaultSave()` always sets it to `'normal'`; consumers reading from a
   * loaded save should treat `undefined` as `'normal'` for §15 compatibility.
   */
  difficultyPreset: PlayerDifficultyPresetSchema.optional(),
  /**
   * Optional so v1 saves written before this field was added still load.
   * `defaultSave()` always sets it to `'auto'`; consumers reading from a
   * loaded save should treat `undefined` as `'auto'` per the §10 default.
   */
  transmissionMode: TransmissionModeSchema.optional(),
});
export type SaveGameSettings = z.infer<typeof SaveGameSettingsSchema>;

const installedUpgradesObject = z.object(
  Object.fromEntries(
    UpgradeCategorySchema.options.map((cat) => [cat, nonNegInt]),
  ) as Record<UpgradeCategory, typeof nonNegInt>,
);

export const SaveGameGarageSchema = z.object({
  credits: nonNegInt,
  ownedCars: z.array(slug).min(1),
  activeCarId: slug,
  installedUpgrades: z.record(slug, installedUpgradesObject),
});
export type SaveGameGarage = z.infer<typeof SaveGameGarageSchema>;

export const SaveGameProgressSchema = z.object({
  unlockedTours: z.array(slug),
  completedTours: z.array(slug),
});
export type SaveGameProgress = z.infer<typeof SaveGameProgressSchema>;

export const SaveGameRecordSchema = z.object({
  bestLapMs: positiveInt,
  bestRaceMs: positiveInt,
  /**
   * Per-sector best splits in milliseconds for the §20 ghost-delta widget.
   * One entry per sector; `bestSplitsMs[i]` is the cumulative time (from the
   * start line) at which the player crossed checkpoint `i + 1` on the best
   * lap. Optional so v1 saves written before this field was added still
   * load. Per the sector-splits dot only overwritten when the overall
   * `bestLapMs` improves; per-sector regressions never write.
   */
  bestSplitsMs: z.array(z.number().nonnegative()).optional(),
});
export type SaveGameRecord = z.infer<typeof SaveGameRecordSchema>;

export const SaveGameSchema = z.object({
  version: positiveInt,
  profileName: z.string().min(1),
  settings: SaveGameSettingsSchema,
  garage: SaveGameGarageSchema,
  progress: SaveGameProgressSchema,
  records: z.record(slug, SaveGameRecordSchema),
});
export type SaveGame = z.infer<typeof SaveGameSchema>;
