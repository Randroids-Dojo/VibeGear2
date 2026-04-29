import type { CompiledSegment } from "@/road/types";

export type TunnelPhase = "open" | "entering" | "inside" | "exiting";

export interface TunnelState {
  readonly phase: TunnelPhase;
  readonly elapsedMs: number;
}

export interface StepTunnelStateInput {
  readonly state: TunnelState;
  readonly dtMs: number;
  readonly inTunnel: boolean;
  readonly transitionMs?: number;
}

export const DEFAULT_TUNNEL_TRANSITION_MS = 400;
export const OPEN_TUNNEL_STATE: TunnelState = Object.freeze({
  phase: "open",
  elapsedMs: 0,
});

export function segmentIsTunnel(segment: Pick<CompiledSegment, "inTunnel" | "hazardIds">): boolean {
  return segment.inTunnel === true || segment.hazardIds.includes("tunnel");
}

export function stepTunnelState(input: StepTunnelStateInput): TunnelState {
  const transitionMs = positiveOr(input.transitionMs, DEFAULT_TUNNEL_TRANSITION_MS);
  const dtMs = Math.max(0, finiteOr(input.dtMs, 0));
  const state = input.state;

  if (input.inTunnel) {
    if (state.phase === "inside") return { phase: "inside", elapsedMs: transitionMs };
    const elapsedMs =
      state.phase === "entering"
        ? Math.min(transitionMs, state.elapsedMs + dtMs)
        : state.phase === "exiting"
          ? Math.min(transitionMs, transitionMs - state.elapsedMs + dtMs)
          : Math.min(transitionMs, dtMs);
    return elapsedMs >= transitionMs
      ? { phase: "inside", elapsedMs: transitionMs }
      : { phase: "entering", elapsedMs };
  }

  if (state.phase === "open") return OPEN_TUNNEL_STATE;
  const elapsedMs =
    state.phase === "exiting"
      ? Math.min(transitionMs, state.elapsedMs + dtMs)
      : state.phase === "entering"
        ? Math.min(transitionMs, transitionMs - state.elapsedMs + dtMs)
        : Math.min(transitionMs, dtMs);
  return elapsedMs >= transitionMs
    ? OPEN_TUNNEL_STATE
    : { phase: "exiting", elapsedMs };
}

export function tunnelOcclusion(
  state: TunnelState,
  transitionMs = DEFAULT_TUNNEL_TRANSITION_MS,
): number {
  const duration = positiveOr(transitionMs, DEFAULT_TUNNEL_TRANSITION_MS);
  switch (state.phase) {
    case "inside":
      return 1;
    case "entering":
      return clampUnit(state.elapsedMs / duration);
    case "exiting":
      return 1 - clampUnit(state.elapsedMs / duration);
    case "open":
      return 0;
  }
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value <= 0
    ? fallback
    : value;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
