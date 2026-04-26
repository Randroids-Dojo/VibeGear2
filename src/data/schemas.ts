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
});
export type Track = z.infer<typeof TrackSchema>;

// Car -----------------------------------------------------------------------

export const CarClassSchema = z.enum([
  "balance",
  "speed",
  "grip",
  "accel",
  "heavy",
  "light",
]);
export type CarClass = z.infer<typeof CarClassSchema>;

export const CarBaseStatsSchema = z.object({
  topSpeed: positiveNumber,
  accel: positiveNumber,
  brake: positiveNumber,
  gripDry: positiveNumber,
  gripWet: positiveNumber,
  stability: positiveNumber,
  durability: unitInterval,
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

// Save-game -----------------------------------------------------------------

export const SpeedUnitSchema = z.enum(["kph", "mph"]);
export type SpeedUnit = z.infer<typeof SpeedUnitSchema>;

export const AssistSettingsSchema = z.object({
  steeringAssist: z.boolean(),
  autoNitro: z.boolean(),
  weatherVisualReduction: z.boolean(),
});
export type AssistSettings = z.infer<typeof AssistSettingsSchema>;

export const SaveGameSettingsSchema = z.object({
  displaySpeedUnit: SpeedUnitSchema,
  assists: AssistSettingsSchema,
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
