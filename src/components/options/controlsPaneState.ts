/**
 * Pure state helpers for the Controls pane (GDD section 19 remapping).
 */

import type { SaveGame } from "@/data/schemas";
import {
  DEFAULT_KEY_BINDINGS,
  type Action,
} from "@/game/input";

export interface ControlActionSpec {
  readonly action: Action;
  readonly label: string;
}

export const CONTROL_ACTIONS: ReadonlyArray<ControlActionSpec> = [
  { action: "accelerate", label: "Accelerate" },
  { action: "brake", label: "Brake / reverse" },
  { action: "left", label: "Steer left" },
  { action: "right", label: "Steer right" },
  { action: "nitro", label: "Nitro" },
  { action: "handbrake", label: "Handbrake" },
  { action: "pause", label: "Pause" },
  { action: "shiftUp", label: "Shift up" },
  { action: "shiftDown", label: "Shift down" },
];

export type KeyBindingsByAction = Record<Action, string[]>;

export type ApplyKeyBindingResult =
  | { kind: "applied"; save: SaveGame }
  | { kind: "noop"; reason: "same-binding" }
  | { kind: "error"; reason: "conflict"; conflictingAction: Action };

export function defaultKeyBindings(): KeyBindingsByAction {
  const out = {} as KeyBindingsByAction;
  for (const { action } of CONTROL_ACTIONS) {
    out[action] = [...DEFAULT_KEY_BINDINGS[action]];
  }
  return out;
}

export function readKeyBindings(save: SaveGame): KeyBindingsByAction {
  const out = defaultKeyBindings();
  const persisted = save.settings.keyBindings;
  if (!persisted) return out;
  for (const { action } of CONTROL_ACTIONS) {
    const raw = persisted[action];
    if (Array.isArray(raw) && raw.length > 0) {
      out[action] = raw.slice(0, 4);
    }
  }
  return out;
}

export function primaryBindingLabel(bindings: KeyBindingsByAction, action: Action): string {
  return formatKeyToken(bindings[action]?.[0] ?? DEFAULT_KEY_BINDINGS[action][0] ?? "");
}

export function formatKeyToken(token: string): string {
  if (token === " ") return "Space";
  if (token === "Space") return "Space";
  if (token.startsWith("Key") && token.length === 4) return token.slice(3);
  if (token.startsWith("Digit") && token.length === 6) return token.slice(5);
  if (token.startsWith("Arrow")) return token.replace("Arrow", "");
  if (token === "Escape") return "Esc";
  if (token === "ShiftLeft") return "Left Shift";
  if (token === "ShiftRight") return "Right Shift";
  return token;
}

export function tokenFromKeyboardEvent(event: Pick<KeyboardEvent, "code" | "key">): string {
  return event.code || event.key;
}

export function applyPrimaryKeyBinding(
  save: SaveGame,
  action: Action,
  token: string,
): ApplyKeyBindingResult {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return { kind: "noop", reason: "same-binding" };
  }

  const current = readKeyBindings(save);
  if (current[action]?.length === 1 && current[action]?.[0] === trimmed) {
    return { kind: "noop", reason: "same-binding" };
  }

  for (const { action: other } of CONTROL_ACTIONS) {
    if (other === action) continue;
    if (current[other]?.includes(trimmed)) {
      return { kind: "error", reason: "conflict", conflictingAction: other };
    }
  }

  const nextBindings: KeyBindingsByAction = {
    ...current,
    [action]: [trimmed],
  };
  return {
    kind: "applied",
    save: {
      ...save,
      settings: {
        ...save.settings,
        keyBindings: nextBindings,
      },
    },
  };
}

export function resetKeyBindings(save: SaveGame): SaveGame {
  return {
    ...save,
    settings: {
      ...save.settings,
      keyBindings: defaultKeyBindings(),
    },
  };
}

export function labelForAction(action: Action): string {
  return CONTROL_ACTIONS.find((item) => item.action === action)?.label ?? action;
}
