/**
 * Format a one-string race-share card per F-100. Generalises the
 * dormant `formatDailyChallengeShareText` (cut by Q-015) into a
 * Tour-finish share string the §20 results screen surfaces for
 * every World Tour race.
 *
 * Pure: same inputs always produce the same string. No locale
 * dependence except the existing `Intl.NumberFormat` style the
 * results screen already uses for cash; here we keep the shape
 * portable so a copied string reads the same in any chat client.
 *
 * Output shape (multi-line for readability when pasted):
 *
 *   VibeGear2 race result
 *   Iron Borough - Foundry Mile
 *   P3, 2:14.318
 *   Best lap 0:42.156
 *
 * For a DNF the third line drops the time:
 *
 *   VibeGear2 race result
 *   Iron Borough - Foundry Mile
 *   DNF
 *
 * Tour name omits when unknown (e.g. legacy non-Tour modes that
 * survived under F-090). Best-lap line omits when the player set
 * no timed lap.
 */

export interface FormatRaceShareInput {
  readonly trackName: string;
  readonly tourName: string | null;
  readonly placement: number | null;
  readonly status: "finished" | "dnf";
  readonly raceTimeMs: number | null;
  readonly bestLapMs: number | null;
}

export function formatRaceShareText(input: FormatRaceShareInput): string {
  const lines: string[] = [];
  lines.push("VibeGear2 race result");
  if (input.tourName !== null && input.tourName !== "") {
    lines.push(`${input.tourName} - ${input.trackName}`);
  } else {
    lines.push(input.trackName);
  }
  if (input.status === "dnf") {
    lines.push("DNF");
    return lines.join("\n");
  }
  const placementLabel =
    input.placement !== null ? `P${input.placement}` : "Finished";
  if (input.raceTimeMs !== null) {
    lines.push(`${placementLabel}, ${formatLapTime(input.raceTimeMs)}`);
  } else {
    lines.push(placementLabel);
  }
  if (input.bestLapMs !== null) {
    lines.push(`Best lap ${formatLapTime(input.bestLapMs)}`);
  }
  return lines.join("\n");
}

/**
 * Format a millisecond duration as `M:SS.mmm` (or `H:MM:SS.mmm` for
 * runs over an hour, defensive only since v1.0 races never go past
 * ~25 min). Mirrors the existing §20 results-page lap-time format
 * so the share string and the on-screen string match.
 */
function formatLapTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00.000";
  const totalSeconds = Math.floor(ms / 1000);
  const millis = Math.floor(ms % 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(millis).padStart(3, "0");
  if (hours > 0) {
    const mm = String(minutes).padStart(2, "0");
    return `${hours}:${mm}:${ss}.${mmm}`;
  }
  return `${minutes}:${ss}.${mmm}`;
}
