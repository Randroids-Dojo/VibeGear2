import { isMixerSilent, resolveMixerGains, type MixerSettings } from "./mixer";

export interface TunnelBusSpec {
  readonly lowPassCutoffHz: number;
  readonly reverbSend: number;
  readonly outputGain: number;
}

export interface ApplyTunnelFilterInput {
  readonly occlusion: number;
  readonly audio?: MixerSettings;
  readonly baseCutoffHz?: number;
  readonly tunnelCutoffHz?: number;
  readonly maxReverbSend?: number;
}

const DEFAULT_BASE_CUTOFF_HZ = 12000;
const DEFAULT_TUNNEL_CUTOFF_HZ = 1400;
const DEFAULT_MAX_REVERB_SEND = 0.58;

export function applyTunnelFilter(input: ApplyTunnelFilterInput): TunnelBusSpec | null {
  const gains = resolveMixerGains(input.audio ?? { master: 0, music: 0, sfx: 0 });
  if (gains === null || isMixerSilent(gains)) return null;

  const occlusion = clampUnit(input.occlusion);
  const baseCutoffHz = positiveOr(input.baseCutoffHz, DEFAULT_BASE_CUTOFF_HZ);
  const tunnelCutoffHz = positiveOr(input.tunnelCutoffHz, DEFAULT_TUNNEL_CUTOFF_HZ);
  const maxReverbSend = clampUnit(input.maxReverbSend ?? DEFAULT_MAX_REVERB_SEND);

  return {
    lowPassCutoffHz: lerp(baseCutoffHz, tunnelCutoffHz, occlusion),
    reverbSend: maxReverbSend * occlusion * gains.sfx,
    outputGain: gains.master * gains.sfx,
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
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
