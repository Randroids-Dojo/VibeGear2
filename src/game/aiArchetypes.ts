import type { AIArchetype } from "@/data/schemas";

export interface AIBehaviour {
  readonly archetype: AIArchetype;
  readonly gddName: string;
  readonly targetSpeedScalar: number;
  readonly curveBrakeScalar: number;
  readonly racingLineScalar: number;
  readonly mistakeScalar: number;
  readonly recoveryScalar: number;
  readonly launchPaceBonus: number;
  readonly fadePacePenalty: number;
  readonly lowVisibilityBrakeScalar: number;
  readonly brilliantChance: number;
  readonly brilliantPaceBonus: number;
  /**
   * Lateral offset bias, in meters, applied toward the player when the
   * player is close enough to engage traffic pressure.
   */
  readonly trafficLanePressure: number;
  /**
   * Multiplier on the overtake pass margin. `1.0` is the default
   * polite pass; `< 1.0` rubs more (aggressive / bully); `> 1.0`
   * leaves more room (defender / cautious). The product
   * `OVERTAKE_PLAYER_MARGIN_METERS * passMarginScalar` is the
   * effective lateral spacing the AI tries to keep from a target
   * during a pass.
   */
  readonly passMarginScalar: number;
  /**
   * When `true`, the overtake routine reads the authored curve under
   * the AI and prefers the inside line in a braking zone (tight
   * curve) and the outside line in a sweeper (gentle curve). When
   * `false` the archetype falls back to the simple "easier-pass"
   * rule (whichever side has more room) regardless of context. The
   * bully archetype reads `false` per §15 "Passing behavior" - the
   * bully ignores convention.
   */
  readonly prefersContextPasses: boolean;
}

export const AI_ARCHETYPE_BEHAVIOURS: Readonly<Record<AIArchetype, AIBehaviour>> =
  Object.freeze({
    nitro_burst: Object.freeze({
      archetype: "nitro_burst",
      gddName: "Rocket starter",
      targetSpeedScalar: 1.02,
      curveBrakeScalar: 1,
      racingLineScalar: 1,
      mistakeScalar: 1.05,
      recoveryScalar: 0.9,
      launchPaceBonus: 0.08,
      fadePacePenalty: 0.04,
      lowVisibilityBrakeScalar: 0,
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0.05,
      passMarginScalar: 1,
      prefersContextPasses: true,
    }),
    clean_line: Object.freeze({
      archetype: "clean_line",
      gddName: "Clean line",
      targetSpeedScalar: 1,
      curveBrakeScalar: 1,
      racingLineScalar: 1,
      mistakeScalar: 1,
      recoveryScalar: 1,
      launchPaceBonus: 0,
      fadePacePenalty: 0,
      lowVisibilityBrakeScalar: 0,
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0,
      passMarginScalar: 1,
      prefersContextPasses: true,
    }),
    aggressive: Object.freeze({
      archetype: "aggressive",
      gddName: "Bully",
      targetSpeedScalar: 1.01,
      curveBrakeScalar: 0.95,
      racingLineScalar: 0.9,
      mistakeScalar: 1.15,
      recoveryScalar: 1.05,
      launchPaceBonus: 0.02,
      fadePacePenalty: 0,
      lowVisibilityBrakeScalar: 0,
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0.45,
      // Bully rubs more on a pass: 60 % of the polite pass margin.
      passMarginScalar: 0.6,
      // Bully ignores convention - takes the easier pass regardless
      // of inside / outside line context.
      prefersContextPasses: false,
    }),
    defender: Object.freeze({
      archetype: "defender",
      gddName: "Cautious",
      targetSpeedScalar: 0.97,
      curveBrakeScalar: 1.18,
      racingLineScalar: 0.85,
      mistakeScalar: 0.7,
      recoveryScalar: 0.75,
      launchPaceBonus: 0,
      fadePacePenalty: 0,
      lowVisibilityBrakeScalar: 0.28,
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: -0.2,
      // Cautious leaves more lateral room on a pass.
      passMarginScalar: 1.25,
      prefersContextPasses: true,
    }),
    wet_specialist: Object.freeze({
      archetype: "wet_specialist",
      gddName: "Chaotic",
      targetSpeedScalar: 1,
      curveBrakeScalar: 0.9,
      racingLineScalar: 1.1,
      mistakeScalar: 1.8,
      recoveryScalar: 1,
      launchPaceBonus: 0.01,
      fadePacePenalty: 0,
      lowVisibilityBrakeScalar: 0,
      brilliantChance: 0.015,
      brilliantPaceBonus: 0.06,
      trafficLanePressure: 0.2,
      passMarginScalar: 1,
      // Chaotic is occasionally brilliant, occasionally wrong - we
      // let it follow context too so the brilliant moments are read-
      // able as actual racing decisions rather than coin flips.
      prefersContextPasses: true,
    }),
    endurance: Object.freeze({
      archetype: "endurance",
      gddName: "Enduro",
      targetSpeedScalar: 0.99,
      curveBrakeScalar: 0.98,
      racingLineScalar: 1,
      mistakeScalar: 0.45,
      recoveryScalar: 0.85,
      launchPaceBonus: 0,
      fadePacePenalty: 0,
      lowVisibilityBrakeScalar: 0,
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0,
      passMarginScalar: 1,
      prefersContextPasses: true,
    }),
  });

export const AI_ARCHETYPE_ORDER: readonly AIArchetype[] = Object.freeze([
  "nitro_burst",
  "clean_line",
  "aggressive",
  "defender",
  "wet_specialist",
  "endurance",
]);

export function getAIBehaviour(archetype: AIArchetype): AIBehaviour {
  return AI_ARCHETYPE_BEHAVIOURS[archetype];
}
