import { describe, expect, it } from "vitest";

import {
  OPEN_TUNNEL_STATE,
  segmentIsTunnel,
  stepTunnelState,
  tunnelOcclusion,
  type TunnelState,
} from "../tunnelState";

describe("tunnelState", () => {
  it("ramps from open to inside when the car enters a tunnel", () => {
    const entering = stepTunnelState({
      state: OPEN_TUNNEL_STATE,
      dtMs: 200,
      inTunnel: true,
      transitionMs: 400,
    });
    expect(entering).toEqual({ phase: "entering", elapsedMs: 200 });
    expect(tunnelOcclusion(entering, 400)).toBeCloseTo(0.5, 6);

    const inside = stepTunnelState({
      state: entering,
      dtMs: 200,
      inTunnel: true,
      transitionMs: 400,
    });
    expect(inside).toEqual({ phase: "inside", elapsedMs: 400 });
    expect(tunnelOcclusion(inside, 400)).toBe(1);
  });

  it("ramps back to open when the car exits a tunnel", () => {
    const exiting = stepTunnelState({
      state: { phase: "inside", elapsedMs: 400 },
      dtMs: 100,
      inTunnel: false,
      transitionMs: 400,
    });
    expect(exiting).toEqual({ phase: "exiting", elapsedMs: 100 });
    expect(tunnelOcclusion(exiting, 400)).toBeCloseTo(0.75, 6);

    const open = stepTunnelState({
      state: exiting,
      dtMs: 300,
      inTunnel: false,
      transitionMs: 400,
    });
    expect(open).toBe(OPEN_TUNNEL_STATE);
  });

  it("handles reversing out while entering without flicker", () => {
    const entering: TunnelState = { phase: "entering", elapsedMs: 250 };
    const exiting = stepTunnelState({
      state: entering,
      dtMs: 50,
      inTunnel: false,
      transitionMs: 400,
    });
    expect(exiting.phase).toBe("exiting");
    expect(exiting.elapsedMs).toBe(200);
    expect(tunnelOcclusion(exiting, 400)).toBeCloseTo(0.5, 6);
  });

  it("detects both segment tunnel metadata and legacy tunnel hazards", () => {
    expect(segmentIsTunnel({ inTunnel: true, hazardIds: [] })).toBe(true);
    expect(segmentIsTunnel({ hazardIds: ["tunnel"] })).toBe(true);
    expect(segmentIsTunnel({ hazardIds: ["puddle"] })).toBe(false);
  });
});
