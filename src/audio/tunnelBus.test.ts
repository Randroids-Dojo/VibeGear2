import { describe, expect, it } from "vitest";

import { applyTunnelFilter } from "./tunnelBus";

describe("applyTunnelFilter", () => {
  const audio = { enabled: true, master: 1, music: 0.5, sfx: 0.75 };

  it("low-passes and adds reverb as tunnel occlusion rises", () => {
    const spec = applyTunnelFilter({ audio, occlusion: 1 });
    expect(spec).not.toBeNull();
    expect(spec!.lowPassCutoffHz).toBeLessThanOrEqual(1500);
    expect(spec!.reverbSend).toBeCloseTo(0.58 * 0.75, 6);
    expect(spec!.outputGain).toBeCloseTo(0.75, 6);
  });

  it("returns an open-air bus spec when occlusion is zero", () => {
    const spec = applyTunnelFilter({ audio, occlusion: 0 });
    expect(spec).not.toBeNull();
    expect(spec!.lowPassCutoffHz).toBe(12000);
    expect(spec!.reverbSend).toBe(0);
  });

  it("bypasses muted audio", () => {
    expect(
      applyTunnelFilter({
        audio: { enabled: false, master: 1, music: 1, sfx: 1 },
        occlusion: 1,
      }),
    ).toBeNull();
  });
});
