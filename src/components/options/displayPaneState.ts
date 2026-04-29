import type { SaveGame, SpeedUnit } from "@/data/schemas";

export interface DisplaySpeedUnitOption {
  readonly value: SpeedUnit;
  readonly label: string;
  readonly description: string;
}

export const DISPLAY_PANE_HEADLINE = "Display";
export const DISPLAY_PANE_SUBTITLE =
  "Speed unit display for the race HUD. This setting applies immediately to new HUD snapshots.";

export const DISPLAY_SPEED_UNIT_OPTIONS: ReadonlyArray<DisplaySpeedUnitOption> = [
  {
    value: "kph",
    label: "Kilometers per hour",
    description: "Use KM/H in the race HUD speed readout.",
  },
  {
    value: "mph",
    label: "Miles per hour",
    description: "Use MPH in the race HUD speed readout.",
  },
];

export type ApplyDisplaySpeedUnitResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "same-value" };

export function readDisplaySpeedUnit(save: SaveGame): SpeedUnit {
  return save.settings.displaySpeedUnit;
}

export function applyDisplaySpeedUnit(
  save: SaveGame,
  unit: SpeedUnit,
): ApplyDisplaySpeedUnitResult {
  if (save.settings.displaySpeedUnit === unit) {
    return { kind: "noop", reason: "same-value" };
  }
  return {
    kind: "applied",
    save: {
      ...save,
      settings: {
        ...save.settings,
        displaySpeedUnit: unit,
      },
    },
  };
}
