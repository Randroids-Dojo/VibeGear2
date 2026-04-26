"use client";

/**
 * Dev-only page for the deterministic input layer.
 *
 * Visit `/dev/input` and verify that:
 * - Held keyboard arrows / WASD / Space / Shift / Esc / Q / E light up.
 * - Connecting a gamepad shows non-zero stick + trigger values.
 * - Holding Left + Right cancels steer to 0 (the §19 cancellation rule).
 * - Tabbing away (window blur) clears all keyboard-held state.
 *
 * The page samples once per fixed sim step via `startLoop`, the same
 * 60 Hz cadence the real race uses. This keeps the displayed input
 * faithful to what the sim will see.
 */

import { useEffect, useRef, useState } from "react";

import {
  createInputManager,
  NEUTRAL_INPUT,
  type Input,
  type InputManager,
} from "@/game/input";
import { startLoop, type LoopHandle } from "@/game/loop";

interface InputDevMetrics extends Input {
  ticks: number;
  hasGamepad: boolean;
}

const INITIAL: InputDevMetrics = {
  ...NEUTRAL_INPUT,
  ticks: 0,
  hasGamepad: false,
};

export default function InputDevPage() {
  const [metrics, setMetrics] = useState<InputDevMetrics>(INITIAL);
  const loopRef = useRef<LoopHandle | null>(null);
  const inputRef = useRef<InputManager | null>(null);

  useEffect(() => {
    const mgr = createInputManager();
    inputRef.current = mgr;

    // Make sure keystrokes target the page even before the user clicks.
    if (typeof window !== "undefined") {
      window.focus();
    }

    let ticks = 0;
    let lastSample: Input = { ...NEUTRAL_INPUT };
    let lastPushAt = 0;

    loopRef.current = startLoop({
      simulate: () => {
        // One sample per 1/60 s. The sim would consume `lastSample` here.
        lastSample = mgr.sample();
        ticks += 1;
      },
      render: () => {
        // Repaint at most every ~33 ms to keep React off the hot path.
        const now = performance.now();
        if (now - lastPushAt < 33) return;
        lastPushAt = now;
        setMetrics({
          ...lastSample,
          ticks,
          hasGamepad: mgr.hasGamepad(),
        });
      },
    });

    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
      inputRef.current?.dispose();
      inputRef.current = null;
    };
  }, []);

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        color: "var(--fg, #ddd)",
        background: "var(--bg, #111)",
        minHeight: "100vh",
      }}
    >
      <h1>Input dev page</h1>
      <p>
        Live values sampled once per 1/60 s sim tick. Hold arrow keys, WASD,
        Space (nitro), Shift (handbrake), Esc (pause), or Q / E (shifts).
        Connect a gamepad and the right column populates. Tabbing away clears
        held keys; the gamepad column self-heals on next sample.
      </p>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "0.25rem 2rem",
          maxWidth: "32rem",
        }}
      >
        <dt>Sim ticks:</dt>
        <dd data-testid="input-ticks">{metrics.ticks}</dd>

        <dt>Steer:</dt>
        <dd data-testid="input-steer">{metrics.steer.toFixed(3)}</dd>

        <dt>Throttle:</dt>
        <dd data-testid="input-throttle">{metrics.throttle.toFixed(3)}</dd>

        <dt>Brake:</dt>
        <dd data-testid="input-brake">{metrics.brake.toFixed(3)}</dd>

        <dt>Nitro:</dt>
        <dd data-testid="input-nitro">{metrics.nitro ? "on" : "off"}</dd>

        <dt>Handbrake:</dt>
        <dd data-testid="input-handbrake">{metrics.handbrake ? "on" : "off"}</dd>

        <dt>Pause:</dt>
        <dd data-testid="input-pause">{metrics.pause ? "on" : "off"}</dd>

        <dt>Shift up:</dt>
        <dd data-testid="input-shift-up">{metrics.shiftUp ? "on" : "off"}</dd>

        <dt>Shift down:</dt>
        <dd data-testid="input-shift-down">{metrics.shiftDown ? "on" : "off"}</dd>

        <dt>Gamepad:</dt>
        <dd data-testid="input-has-gamepad">
          {metrics.hasGamepad ? "connected" : "none"}
        </dd>
      </dl>
    </main>
  );
}
