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
  readonly brilliantChance: number;
  readonly brilliantPaceBonus: number;
  readonly trafficLanePressure: number;
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
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0.05,
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
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0,
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
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0.45,
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
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: -0.2,
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
      brilliantChance: 0.015,
      brilliantPaceBonus: 0.06,
      trafficLanePressure: 0.2,
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
      brilliantChance: 0,
      brilliantPaceBonus: 0,
      trafficLanePressure: 0,
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
