export interface EnginePitchConfig {
  readonly idleHz: number;
  readonly redlineHz: number;
  readonly riseCurve: number;
  readonly overrunRatio: number;
}

export interface EnginePitchInput {
  readonly speed: number;
  readonly topSpeed: number;
  readonly config?: Partial<EnginePitchConfig>;
}

export const DEFAULT_ENGINE_PITCH: EnginePitchConfig = Object.freeze({
  idleHz: 80,
  redlineHz: 320,
  riseCurve: 3,
  overrunRatio: 1.1,
});

export function engineSpeedRatio(input: EnginePitchInput): number {
  const config = resolveEnginePitchConfig(input.config);
  if (!Number.isFinite(input.speed) || !Number.isFinite(input.topSpeed)) {
    return 0;
  }
  if (input.speed <= 0 || input.topSpeed <= 0) {
    return 0;
  }
  return clamp(input.speed / input.topSpeed, 0, config.overrunRatio);
}

export function enginePitchHz(input: EnginePitchInput): number {
  const config = resolveEnginePitchConfig(input.config);
  const ratio = engineSpeedRatio({ ...input, config });
  const spread = config.redlineHz - config.idleHz;
  const raised = config.idleHz + spread * (1 - Math.exp(-config.riseCurve * ratio));
  return clamp(raised, config.idleHz, config.redlineHz);
}

function resolveEnginePitchConfig(
  override: Partial<EnginePitchConfig> | undefined,
): EnginePitchConfig {
  const idleHz = positiveOr(override?.idleHz, DEFAULT_ENGINE_PITCH.idleHz);
  const redlineHz = Math.max(
    idleHz,
    positiveOr(override?.redlineHz, DEFAULT_ENGINE_PITCH.redlineHz),
  );
  return {
    idleHz,
    redlineHz,
    riseCurve: positiveOr(override?.riseCurve, DEFAULT_ENGINE_PITCH.riseCurve),
    overrunRatio: positiveOr(
      override?.overrunRatio,
      DEFAULT_ENGINE_PITCH.overrunRatio,
    ),
  };
}

function positiveOr(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value <= min) return min;
  if (value >= max) return max;
  return value;
}
