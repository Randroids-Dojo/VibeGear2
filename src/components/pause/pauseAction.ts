/**
 * Pure helpers for the pause overlay's keyboard binding resolution.
 *
 * Source of truth for the pause key: `DEFAULT_KEY_BINDINGS.pause` in
 * `src/game/input.ts` (default `Escape` per `docs/gdd/19-controls-and-input.md`).
 * Once F-014 lands a custom-bindings settings UI, this module will read
 * `save.settings.controlBindings?.pause` and fall back to the default if
 * unset; until then `resolvePauseTokens()` always returns the default.
 *
 * Kept separate from the React component so the binding lookup is testable
 * without a DOM. The overlay itself is a thin shell over this.
 */

import { DEFAULT_KEY_BINDINGS } from "@/game/input";

/**
 * Tokens (`KeyboardEvent.code` and `KeyboardEvent.key` values) that
 * trigger the pause action. Matches the convention in `input.ts`: the
 * input manager checks both code and key per event so the binding is
 * layout-independent for letter keys but still recognises non-letter
 * keys like `Escape`.
 */
export function resolvePauseTokens(): readonly string[] {
  return DEFAULT_KEY_BINDINGS.pause;
}

/**
 * True if the given keyboard event matches one of the pause tokens.
 * Used by the overlay's listener so callers can debounce themselves
 * on the keydown edge without round-tripping through the full input
 * manager (which the race scene already drains for sim input).
 */
export function isPauseEvent(
  event: Pick<KeyboardEvent, "code" | "key" | "repeat">,
  tokens: readonly string[] = resolvePauseTokens(),
): boolean {
  if (event.repeat) return false;
  if (event.code && tokens.includes(event.code)) return true;
  if (event.key && tokens.includes(event.key)) return true;
  return false;
}
