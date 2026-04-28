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

export const HazardKindSchema = z.enum([
  "puddle",
  "slick_paint",
  "traffic_cone",
  "sign",
  "gravel_band",
  "snow_buildup",
  "tunnel",
]);
export type HazardKind = z.infer<typeof HazardKindSchema>;

export const HazardRegistryEntrySchema = z.object({
  id: slug,
  kind: HazardKindSchema,
  displayName: z.string().min(1),
  defaultWidth: positiveNumber,
  defaultLength: positiveNumber,
  laneOffset: z.number().optional(),
  gripMultiplier: positiveNumber.optional(),
  damageKind: z.enum(["rub", "offRoadObject"]).nullable().optional(),
  damageMagnitude: positiveNumber.nullable().optional(),
  breakable: z.boolean(),
});
export type HazardRegistryEntry = z.infer<typeof HazardRegistryEntrySchema>;

export const TrackSegmentSchema = z.object({
  len: positiveNumber,
  curve: z.number().min(-1).max(1),
  grade: z.number().min(-0.3).max(0.3),
  roadsideLeft: z.string().min(1),
  roadsideRight: z.string().min(1),
  hazards: z.array(slug),
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
  /**
   * Optional per-tour sponsor roster keyed by `SponsorObjective.id`. The
   * §5 sponsor bonus picks one sponsor per race in deterministic order
   * (track index modulo roster length); `pickSponsorForTourRace` in
   * `src/game/raceResult.ts` owns the rotation. Optional so v1 tours
   * written before this field was added still validate; the loader treats
   * `undefined` as `[]` (no sponsor active).
   *
   * Each id must resolve via `getSponsorObjective`; an unresolved id
   * silently surfaces as no sponsor for that race rather than throwing,
   * so a content rename does not crash the race-finish flow.
   */
  sponsors: z.array(slug).optional(),
  /**
   * Optional per-tour AI roster keyed by `AIDriver.id`. When present,
   * `/race?tour=...` builds the runtime grid from these drivers up to
   * `track.spawn.gridSlots - 1` opponents. Optional so future tours can
   * keep placeholder structure before their driver lineups are tuned.
   */
  aiDrivers: z.array(slug).optional(),
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

// Sponsor objective ---------------------------------------------------------

/**
 * Sponsor objective predicate kinds. Each kind names a deterministic test
 * the §5 sponsor-objective bonus runs against the final RaceState. Adding a
 * new kind is a schema change; the runtime evaluator
 * (`src/game/raceBonuses.ts` `evaluateSponsorObjective`) must learn it in
 * the same slice or the predicate is treated as failed.
 *
 * Pinned set:
 *
 * - `top_speed_at_least`: the player car's race-best top speed (m/s) is at
 *   or above `value`. Reads from the per-car race summary the §7 race
 *   session emits.
 * - `finish_at_or_above`: the player's finishing placement is at or above
 *   (numerically <=) `value`. `value: 3` means top-3 finish.
 * - `clean_race`: the player took no contact damage (per the §13 carHit /
 *   wallHit / offRoadObject events). Same predicate as the clean-race
 *   bonus; sponsors can stack on it.
 * - `no_nitro`: the player never fired a nitro burst. Reads the per-car
 *   nitro-fired flag the §7 session emits.
 * - `weather_finish_top_n`: the player finished in the top `value` while
 *   the active weather was one of `weather`. Lets a sponsor objective
 *   say "place top 3 in rain" without baking weather into the kind.
 */
export const SponsorObjectiveKindSchema = z.enum([
  "top_speed_at_least",
  "finish_at_or_above",
  "clean_race",
  "no_nitro",
  "weather_finish_top_n",
]);
export type SponsorObjectiveKind = z.infer<typeof SponsorObjectiveKindSchema>;

/**
 * One sponsor entry. The objective predicate is a discriminated union on
 * `kind`; the optional `value` and `weather` fields are read by the
 * evaluator only when the kind requires them. The schema deliberately
 * keeps both optional so a `clean_race` entry does not have to ship a
 * placeholder value.
 *
 * `cashCredits` is the flat reward in credits paid on objective success.
 * The §5 sponsor bonus does not scale with the per-track base reward
 * because sponsors are a flat per-race contract; balancing pass owns
 * the absolute values.
 *
 * `weather` is a list of `WeatherOption` entries; the predicate matches
 * if the active weather at race finish is in the list. Required for the
 * `weather_finish_top_n` kind, ignored for all others.
 */
export const SponsorObjectiveSchema = z.object({
  id: slug,
  sponsorName: z.string().min(1),
  description: z.string().min(1),
  kind: SponsorObjectiveKindSchema,
  value: z.number().optional(),
  weather: z.array(WeatherOptionSchema).optional(),
  cashCredits: nonNegInt,
});
export type SponsorObjective = z.infer<typeof SponsorObjectiveSchema>;

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

/**
 * §20 'Audio' settings bundle. Each level is a unit-interval scalar applied as
 * a multiplier on the matching mix bus. The Sound + Music dot consumes these
 * fields; this schema is the shared persistence contract so the HUD and audio
 * slices read and write the same shape.
 *
 * - `master`: global output gain. 1.0 is the GDD reference level.
 * - `music`: music-bus multiplier, applied after `master`.
 * - `sfx`: SFX-bus multiplier (engine, tyre, hazard, UI), applied after
 *   `master`.
 */
export const AudioSettingsSchema = z.object({
  master: unitInterval,
  music: unitInterval,
  sfx: unitInterval,
});
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;

/**
 * §20 'Accessibility' settings bundle. Renderer / HUD / input slices each
 * own a subset of these flags; this schema is the shared persistence
 * contract.
 *
 * - `colorBlindMode`: tint LUT for the renderer. `off` keeps the default
 *   palette. The runtime LUT lookup is owned by the §16 renderer slice; this
 *   field only persists the player's preference.
 * - `reducedMotion`: when true, the §16 renderer dampens screen shake and
 *   skips parallax flicker. Independent of `screenShakeScale`; reducedMotion
 *   reads as a stronger semantic preference (assistive-tech bridge) while
 *   screenShakeScale is a fine-grained slider.
 * - `largeUiText`: when true, the HUD scales body-text glyphs up. Headline
 *   numerics (speed, lap timer) keep their HUD size so the layout does not
 *   reflow.
 * - `screenShakeScale`: 0..1 multiplier on the §16 shake intensity. 0
 *   disables shake entirely; consumers must guard against multiplying NaN /
 *   negative input by clamping to this range at parse time.
 * - `weatherParticleIntensity`: 0..1 multiplier for rain and snow particles.
 * - `reducedWeatherGlare`: dampens weather bloom in dusk and night races.
 * - `fogReadabilityClamp`: minimum fog visibility target for readability.
 * - `weatherFlashReduction`: further reduces high-contrast weather flashes.
 */
export const AccessibilitySettingsSchema = z.object({
  colorBlindMode: z.enum(["off", "protanopia", "deuteranopia", "tritanopia"]),
  reducedMotion: z.boolean(),
  largeUiText: z.boolean(),
  screenShakeScale: unitInterval,
  weatherParticleIntensity: unitInterval.optional(),
  reducedWeatherGlare: z.boolean().optional(),
  fogReadabilityClamp: unitInterval.optional(),
  weatherFlashReduction: z.boolean().optional(),
});
export type AccessibilitySettings = z.infer<typeof AccessibilitySettingsSchema>;

/**
 * §19 'Keyboard layout' persisted re-binding map. Keyed by the logical
 * `Action` (see `src/game/input.ts`), mapped to a non-empty list of
 * `KeyboardEvent.code` (or `key`) tokens that resolve to that action.
 *
 * The schema deliberately stays loose on the action key (`z.string()`) so
 * a future action added to `src/game/input.ts` does not require a v3
 * migration. The runtime input layer ignores keys it does not recognise
 * and logs once at load time per the §19 'unknown binding' rule.
 *
 * Each token list is bounded to 4 entries so a hostile or corrupt save
 * cannot force the input layer to walk an unbounded array per keypress.
 */
export const KeyBindingsSchema = z.record(
  z.string().min(1),
  z.array(z.string().min(1)).min(1).max(4),
);
export type KeyBindings = z.infer<typeof KeyBindingsSchema>;

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
  /**
   * §20 audio mix levels. Optional so v1 saves migrate cleanly via
   * `migrations/v1ToV2.ts`; the migrator fills documented defaults
   * (master 1.0, music 0.8, sfx 0.9). `defaultSave()` always sets it.
   */
  audio: AudioSettingsSchema.optional(),
  /**
   * §20 accessibility prefs. Optional so v1 saves migrate cleanly. The
   * v1ToV2 migrator fills documented defaults (colorBlindMode 'off',
   * reducedMotion false, largeUiText false, screenShakeScale 1.0).
   */
  accessibility: AccessibilitySettingsSchema.optional(),
  /**
   * §19 key bindings. Optional so v1 saves migrate cleanly. The v1ToV2
   * migrator fills the map from `DEFAULT_KEY_BINDINGS` in
   * `src/game/input.ts`. Consumers reading from a loaded save should
   * fall back to the defaults when a key is missing.
   */
  keyBindings: KeyBindingsSchema.optional(),
});
export type SaveGameSettings = z.infer<typeof SaveGameSettingsSchema>;

const installedUpgradesObject = z.object(
  Object.fromEntries(
    UpgradeCategorySchema.options.map((cat) => [cat, nonNegInt]),
  ) as Record<UpgradeCategory, typeof nonNegInt>,
);

const saveDamageZonesObject = z.object({
  engine: unitInterval,
  tires: unitInterval,
  body: unitInterval,
});

const saveDamageStateObject = z.object({
  zones: saveDamageZonesObject,
  total: unitInterval,
  offRoadAccumSeconds: z.number().nonnegative(),
});

export const SaveGameGarageSchema = z.object({
  credits: nonNegInt,
  ownedCars: z.array(slug).min(1),
  activeCarId: slug,
  installedUpgrades: z.record(slug, installedUpgradesObject),
  pendingDamage: z.record(slug, saveDamageStateObject).optional(),
  lastRaceCashEarned: nonNegInt.optional(),
});
export type SaveGameGarage = z.infer<typeof SaveGameGarageSchema>;

export const SaveGameActiveTourRaceResultSchema = z.object({
  trackId: slug,
  placement: nonNegInt,
  dnf: z.boolean(),
  cashEarned: nonNegInt.optional(),
});
export type SaveGameActiveTourRaceResult = z.infer<
  typeof SaveGameActiveTourRaceResultSchema
>;

export const SaveGameActiveTourSchema = z.object({
  tourId: slug,
  raceIndex: nonNegInt,
  results: z.array(SaveGameActiveTourRaceResultSchema),
});
export type SaveGameActiveTour = z.infer<typeof SaveGameActiveTourSchema>;

export const SaveGameProgressSchema = z.object({
  unlockedTours: z.array(slug),
  completedTours: z.array(slug),
  /**
   * Active World Tour cursor, persisted while the player is between
   * races in a four-race tour. `raceIndex` points at the next race to
   * run, and `results` stores completed race outcomes in order so the
   * results screen can resume, finish, and unlock tours deterministically.
   * Optional so saves without an in-progress tour still load cleanly.
   */
  activeTour: SaveGameActiveTourSchema.optional(),
  /**
   * One-shot tour-stipend claim ledger per `docs/gdd/12-upgrade-and-economy-system.md`
   * "Catch-up mechanisms". Maps a tour id to `true` once the under-threshold
   * stipend has been granted for that tour. Optional so v1 saves written
   * before this field was added still load; consumers reading from a
   * loaded save should treat `undefined` as `{}` per the catch-up
   * module's `getStipendClaimed` helper. The literal-true value (rather
   * than a count) is intentional: the §12 stipend is one-shot per tour,
   * and a future "second stipend" would land as a new field rather than
   * overloading this one.
   */
  stipendsClaimed: z.record(slug, z.literal(true)).optional(),
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

// Ghost replay -------------------------------------------------------------

/**
 * One per-tick input delta inside a ghost replay. Mirrors the runtime
 * `ReplayDelta` shape in `src/game/ghost.ts`; the schema lives here so
 * the persistence layer owns the on-disk validator without dragging the
 * game module into the schemas import surface.
 *
 * Fields:
 * - `tick`: u32 tick index since the recording started. Strictly increases
 *   across the deltas array; the recorder never emits a no-change tick.
 * - `mask`: u8 bitmask. Bit `i` set means `INPUT_FIELDS[i]` is in the
 *   `values` array. Mask `0` is rejected because a zero mask means
 *   "nothing changed", which the recorder filters out before write.
 * - `values`: parallel array, one entry per set bit in `mask`, in the bit
 *   order the recorder pinned. Numbers for numeric fields, booleans for
 *   boolean fields. Loose `z.union` is intentional: schemas.ts cannot
 *   reach into the runtime `Input` type without a cycle.
 */
export const GhostReplayDeltaSchema = z.object({
  tick: nonNegInt,
  mask: z.number().int().min(1).max(0xff),
  values: z.array(z.union([z.number(), z.boolean()])),
});
export type GhostReplayDelta = z.infer<typeof GhostReplayDeltaSchema>;

/**
 * Persisted ghost replay payload. The shape mirrors the runtime `Replay`
 * in `src/game/ghost.ts` so a `Replay` value drops directly into the
 * save without an adapter layer.
 *
 * The map key in `SaveGameSchema.ghosts` is the track slug (the same id
 * used in `records`); this schema is the per-track entry. A future
 * "multiple ghosts per track" expansion would change the map value to an
 * array; today the §6 Time Trial loop only stores one PB per track.
 *
 * Field stamps (`formatVersion`, `physicsVersion`, `fixedStepMs`) are
 * load-bearing for replay determinism: the runtime `createPlayer`
 * rejects a replay whose stamps do not match the runtime, so a stale
 * ghost is silently dropped rather than rendered incorrectly.
 */
export const GhostReplaySchema = z.object({
  formatVersion: positiveInt,
  physicsVersion: positiveInt,
  fixedStepMs: positiveNumber,
  trackId: slug,
  trackVersion: positiveInt,
  carId: slug,
  seed: nonNegInt,
  totalTicks: nonNegInt,
  finalTimeMs: z.number().nonnegative(),
  truncated: z.boolean(),
  deltas: z.array(GhostReplayDeltaSchema),
});
export type GhostReplay = z.infer<typeof GhostReplaySchema>;

export const SaveGameSchema = z.object({
  version: positiveInt,
  profileName: z.string().min(1),
  settings: SaveGameSettingsSchema,
  garage: SaveGameGarageSchema,
  progress: SaveGameProgressSchema,
  records: z.record(slug, SaveGameRecordSchema),
  /**
   * Per-write monotonic counter (advisory) used by the cross-tab
   * last-write-wins protocol in `src/persistence/save.ts`. Optional so
   * v1 saves and any pre-counter v2 saves still validate; the loader
   * treats `undefined` as `0` and `saveSave` increments before writing.
   * `writeCounter` is independent of the schema `version` field: the
   * schema major bumps for shape changes, the counter ticks every
   * persisted write. See `docs/gdd/21-technical-design-for-web-implementation.md`
   * "Cross-tab consistency".
   */
  writeCounter: z.number().int().nonnegative().optional(),
  /**
   * §6 Time Trial PB ghost replays, keyed by track slug. Each entry is
   * the player's current best replay for that track; the §6 Time Trial
   * UI compares a finished run against the stored entry via
   * `bestGhostFor` in `src/game/ghost.ts` and replaces only when the new
   * run is strictly faster. Optional so v1 / v2 saves written before
   * this field was added still validate; the v2 to v3 migrator seeds an
   * empty `{}` so loaders can `save.ghosts ?? {}` without re-checking
   * the version field. The track id key uses the same `slug` shape as
   * `records` so a missing-track ghost cannot diverge from a missing
   * record. Per `docs/gdd/22-data-schemas.md`.
   */
  ghosts: z.record(slug, GhostReplaySchema).optional(),
});
export type SaveGame = z.infer<typeof SaveGameSchema>;
