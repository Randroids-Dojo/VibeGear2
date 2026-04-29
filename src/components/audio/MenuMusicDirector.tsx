"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import type { AudioSettings } from "@/data/schemas";
import { titleMusicCue, MusicRuntime } from "@/audio/music";
import { defaultSave, loadSave } from "@/persistence/save";

const DEFAULT_AUDIO_SETTINGS: AudioSettings = Object.freeze({
  master: 1,
  music: 0.8,
  sfx: 0.9,
});

const MENU_MUSIC_PATHS = new Set([
  "/",
  "/world",
  "/daily",
  "/garage",
  "/garage/cars",
  "/garage/repair",
  "/garage/upgrade",
  "/options",
]);

export function MenuMusicDirector(): null {
  const pathname = usePathname();
  const runtimeRef = useRef<MusicRuntime | null>(null);
  const armedRef = useRef(false);
  const audioRef = useRef<AudioSettings>(DEFAULT_AUDIO_SETTINGS);

  if (runtimeRef.current === null) {
    runtimeRef.current = new MusicRuntime();
  }

  useEffect(() => {
    const loaded = loadSave();
    audioRef.current =
      loaded.kind === "loaded"
        ? (loaded.save.settings.audio ?? DEFAULT_AUDIO_SETTINGS)
        : (defaultSave().settings.audio ?? DEFAULT_AUDIO_SETTINGS);
  }, [pathname]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    const shouldPlay = pathname === null ? false : MENU_MUSIC_PATHS.has(pathname);
    let animationFrame: number | null = null;

    const update = (): void => {
      runtime.update(audioRef.current);
      animationFrame = window.requestAnimationFrame(update);
    };

    const play = (): void => {
      armedRef.current = true;
      runtime.play(titleMusicCue(), audioRef.current);
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(update);
      }
    };

    if (!shouldPlay) {
      runtime.stop();
      return () => {};
    }

    if (armedRef.current) {
      play();
    } else {
      window.addEventListener("pointerdown", play, { once: true });
      window.addEventListener("keydown", play, { once: true });
    }

    return () => {
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [pathname]);

  return null;
}
