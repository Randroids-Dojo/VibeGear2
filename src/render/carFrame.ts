/**
 * Frame selection helpers for the live car atlas overlay.
 *
 * The Sparrow atlas row is authored as center, right lean, then wraps
 * through left lean at the end of the row. Positive steer means the
 * car moves right on screen, so it must select the negative-skew frames
 * near the row end.
 */

export function playerCarFrameIndex(steer: number, roadCurve: number): number {
  const visualSteer = Math.max(-1, Math.min(1, steer + roadCurve * 0.35));
  if (visualSteer <= -0.66) return 2;
  if (visualSteer <= -0.25) return 1;
  if (visualSteer >= 0.66) return 10;
  if (visualSteer >= 0.25) return 11;
  return 0;
}
