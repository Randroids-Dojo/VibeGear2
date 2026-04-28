import { describe, expect, it } from "vitest";

import { isMixerSilent, resolveMixerGains } from "./mixer";

describe("resolveMixerGains", () => {
  it("returns raw bus gains for the Web Audio routing graph", () => {
    expect(
      resolveMixerGains({ master: 0.5, music: 0.8, sfx: 0.25 }),
    ).toEqual({
      master: 0.5,
      music: 0.8,
      sfx: 0.25,
    });
  });

  it("covers boundary values", () => {
    expect(resolveMixerGains({ master: 0, music: 1, sfx: 1 })).toEqual({
      master: 0,
      music: 1,
      sfx: 1,
    });
    expect(resolveMixerGains({ master: 1, music: 1, sfx: 1 })).toEqual({
      master: 1,
      music: 1,
      sfx: 1,
    });
  });

  it("clamps out-of-range values for defensive runtime callers", () => {
    expect(resolveMixerGains({ master: 2, music: -1, sfx: 0.5 })).toEqual({
      master: 1,
      music: 0,
      sfx: 0.5,
    });
  });

  it("returns null when audio is disabled", () => {
    expect(
      resolveMixerGains({ master: 1, music: 1, sfx: 1, enabled: false }),
    ).toBeNull();
  });
});

describe("isMixerSilent", () => {
  it("treats disabled or inaudible gain paths as silent", () => {
    expect(isMixerSilent(null)).toBe(true);
    expect(isMixerSilent({ master: 0, music: 0, sfx: 0 })).toBe(true);
    expect(isMixerSilent({ master: 0, music: 0.5, sfx: 0 })).toBe(true);
    expect(isMixerSilent({ master: 1, music: 0, sfx: 0 })).toBe(true);
    expect(isMixerSilent({ master: 1, music: 0.5, sfx: 0 })).toBe(false);
  });
});
