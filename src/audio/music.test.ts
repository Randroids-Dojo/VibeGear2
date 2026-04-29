import { describe, expect, it, vi } from "vitest";

import {
  MUSIC_CUES,
  MusicRuntime,
  raceMusicCue,
  raceMusicIntensity,
  titleMusicCue,
  type MusicAudioElementLike,
} from "./music";

const AUDIO = { master: 1, music: 0.8, sfx: 0.9 };

describe("music cues", () => {
  it("maps menu playback to the title cue", () => {
    expect(titleMusicCue()).toEqual(MUSIC_CUES.title);
  });

  it("maps race tracks and tours to regional cues", () => {
    expect(raceMusicCue({ trackId: "velvet-coast/harbor-run" }).id).toBe(
      "velvet-coast",
    );
    expect(raceMusicCue({ trackId: "test/elevation", tourId: "iron-borough" }).id).toBe(
      "iron-borough",
    );
    expect(raceMusicCue({ trackId: "neon-meridian/night-loop" }).id).toBe(
      "neon-meridian",
    );
  });
});

describe("raceMusicIntensity", () => {
  it("raises volume and playback rate as speed increases", () => {
    const idle = raceMusicIntensity({ speed: 0, topSpeed: 60 });
    const fast = raceMusicIntensity({ speed: 55, topSpeed: 60 });

    expect(fast.volumeScale).toBeGreaterThan(idle.volumeScale);
    expect(fast.playbackRate).toBeGreaterThan(idle.playbackRate);
  });

  it("adds escalation for nitro and final lap", () => {
    const baseline = raceMusicIntensity({ speed: 45, topSpeed: 60 });
    const escalated = raceMusicIntensity({
      speed: 45,
      topSpeed: 60,
      nitroActive: true,
      finalLap: true,
    });

    expect(escalated.volumeScale).toBeGreaterThan(baseline.volumeScale);
    expect(escalated.playbackRate).toBeGreaterThan(baseline.playbackRate);
  });
});

describe("MusicRuntime", () => {
  it("does not create audio when the music bus is silent", () => {
    const createAudio = vi.fn(() => new FakeMusicElement());
    const runtime = new MusicRuntime({ createAudio });

    expect(
      runtime.play(MUSIC_CUES.title, { master: 1, music: 0, sfx: 1 }),
    ).toBe(false);
    expect(createAudio).not.toHaveBeenCalled();
  });

  it("starts a looping element and fades it up through the music bus", () => {
    let now = 0;
    const elements: FakeMusicElement[] = [];
    const runtime = new MusicRuntime({
      nowSeconds: () => now,
      fadeSeconds: 1,
      baseGain: 0.5,
      createAudio: (src) => {
        const element = new FakeMusicElement();
        element.src = src;
        elements.push(element);
        return element;
      },
    });

    expect(runtime.play(MUSIC_CUES.title, AUDIO)).toBe(true);
    expect(elements).toHaveLength(1);
    expect(elements[0]?.loop).toBe(true);
    expect(elements[0]?.preload).toBe("auto");
    expect(elements[0]?.play).toHaveBeenCalledTimes(1);
    expect(elements[0]?.volume).toBe(0);

    now = 0.5;
    runtime.update(AUDIO);
    expect(elements[0]?.volume).toBeCloseTo(1 * 0.8 * 0.5 * 0.5);

    now = 1;
    runtime.update(AUDIO);
    expect(elements[0]?.volume).toBeCloseTo(1 * 0.8 * 0.5);
  });

  it("crossfades to a new cue and stops the previous element", () => {
    let now = 0;
    const elements: FakeMusicElement[] = [];
    const runtime = new MusicRuntime({
      nowSeconds: () => now,
      fadeSeconds: 1,
      baseGain: 0.5,
      createAudio: (src) => {
        const element = new FakeMusicElement();
        element.src = src;
        elements.push(element);
        return element;
      },
    });

    runtime.play(MUSIC_CUES.title, AUDIO);
    now = 1;
    runtime.update(AUDIO);
    runtime.play(MUSIC_CUES["velvet-coast"], AUDIO);

    expect(elements).toHaveLength(2);
    expect(runtime.currentCueId()).toBe("velvet-coast");
    expect(elements[0]?.volume).toBeCloseTo(1 * 0.8 * 0.5);
    expect(elements[1]?.volume).toBe(0);

    now = 2;
    runtime.update(AUDIO);
    expect(elements[0]?.pause).toHaveBeenCalledTimes(1);
    expect(elements[0]?.volume).toBe(0);
    expect(elements[1]?.volume).toBeCloseTo(1 * 0.8 * 0.5);
  });

  it("stops an older fading cue when another cue replaces it", () => {
    let now = 0;
    const elements: FakeMusicElement[] = [];
    const runtime = new MusicRuntime({
      nowSeconds: () => now,
      fadeSeconds: 1,
      createAudio: (src) => {
        const element = new FakeMusicElement();
        element.src = src;
        elements.push(element);
        return element;
      },
    });

    runtime.play(MUSIC_CUES.title, AUDIO);
    now = 1;
    runtime.update(AUDIO);
    runtime.play(MUSIC_CUES["velvet-coast"], AUDIO);
    now = 1.25;
    runtime.update(AUDIO);
    runtime.play(MUSIC_CUES["iron-borough"], AUDIO);

    expect(elements).toHaveLength(3);
    expect(elements[0]?.pause).toHaveBeenCalledTimes(1);
    expect(elements[0]?.volume).toBe(0);
    expect(runtime.currentCueId()).toBe("iron-borough");
  });

  it("updates playback rate from intensity", () => {
    const now = 1;
    const element = new FakeMusicElement();
    const runtime = new MusicRuntime({
      nowSeconds: () => now,
      createAudio: () => element,
    });

    runtime.play(MUSIC_CUES.title, AUDIO, {
      volumeScale: 1,
      playbackRate: 1.04,
    });

    expect(element.playbackRate).toBe(1.04);
  });
});

class FakeMusicElement implements MusicAudioElementLike {
  src = "";
  loop = false;
  preload = "";
  volume = 0;
  playbackRate = 1;
  currentTime = 0;
  readonly play = vi.fn(() => Promise.resolve());
  readonly pause = vi.fn(() => undefined);
}
