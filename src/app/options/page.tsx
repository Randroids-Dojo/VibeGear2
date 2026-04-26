"use client";

/**
 * Options screen scaffold (GDD §20 Settings, §19 Controls and input).
 *
 * Tabbed shell with six panes (Display, Audio, Controls, Accessibility,
 * Difficulty, Performance) per §20. Each pane renders a "Coming soon"
 * placeholder citing the dot id of the slice that lands its real
 * content, so the next agent can grep its dot id and find the exact
 * insertion point.
 *
 * - The Reset to defaults button is intentionally disabled: full reset
 *   semantics depend on the SaveGameSettings v2 schema landing
 *   (`VibeGear2-implement-savegamesettings-b948015a`). When that ships
 *   the disabled prop and the title hint should both be removed.
 * - Pressing Esc returns to the title screen via `history.back()` when
 *   there is browser history, otherwise it falls through to a hard
 *   navigation to "/". This matches the §20 pause-menu Exit-to-title
 *   pattern but for the title-level options entry point.
 * - Tab navigation uses the WAI-ARIA Authoring Practices keyboard
 *   model: Left / Right cycle with wrap, Home / End jump to ends.
 *   Activation moves the panel because the tabs are
 *   `aria-selected="true"` follows-focus style; this keeps the
 *   keyboard-only path straightforward without needing an Enter step.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactElement } from "react";

import { AccessibilityPane } from "@/components/options/AccessibilityPane";
import { DifficultyPane } from "@/components/options/DifficultyPane";

import styles from "./page.module.css";
import { TAB_ORDER, isTabNavKey, nextTabIndex, type TabKey } from "./tabNav";

interface TabSpec {
  readonly key: TabKey;
  readonly label: string;
  /**
   * Headline shown above the pane body. When `pane` is provided the
   * headline is suppressed and the pane owns its own chrome. Kept for
   * the placeholder tabs that have not yet had real panes mounted.
   */
  readonly headline?: string;
  readonly body?: string;
  /**
   * Dot id of the slice that ships the real pane content. Rendered into
   * the placeholder body so future agents can grep for it. When `pane`
   * is provided the dot is no longer surfaced (the slice has shipped).
   */
  readonly dotId?: string;
  /**
   * Optional shipped pane component. When present, the panel renders
   * this instead of the "coming soon" placeholder.
   */
  readonly pane?: () => ReactElement;
}

const TABS: ReadonlyArray<TabSpec> = [
  {
    key: "display",
    label: "Display",
    headline: "Display options coming soon",
    body: "Resolution, frame cap, viewport scaling, and HUD scale will land alongside the visual polish slice.",
    dotId: "VibeGear2-implement-visual-polish-7d31d112",
  },
  {
    key: "audio",
    label: "Audio",
    headline: "Audio mix coming soon",
    body: "Master, music, SFX, and engine bus volumes plus mute toggles ship with the sound and music systems.",
    dotId: "VibeGear2-implement-sound-music-1611f9dd",
  },
  {
    key: "controls",
    label: "Controls",
    headline: "Control remap coming soon",
    body: "Keyboard and gamepad rebinding lands with the dedicated key remap UI per GDD section 19.",
    dotId: "VibeGear2-implement-key-remap-a0908466",
  },
  {
    key: "accessibility",
    label: "Accessibility",
    pane: () => <AccessibilityPane />,
  },
  {
    key: "difficulty",
    label: "Difficulty",
    pane: () => <DifficultyPane />,
  },
  {
    key: "performance",
    label: "Performance",
    headline: "Performance settings coming soon",
    body: "Draw distance, sprite density, and pixel ratio sliders ship with the performance settings slice.",
    dotId: "VibeGear2-implement-performance-settings-2de5d437",
  },
];

const RESET_PENDING_DOT = "VibeGear2-implement-savegamesettings-b948015a";

export default function OptionsPage(): ReactElement {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusOnUpdateRef = useRef<boolean>(false);

  // Esc returns to the title screen. We use history.back when there is
  // a referrer in this tab's history, otherwise fall through to a hard
  // navigation to "/". Listener is window-level so it fires regardless
  // of focus location inside the page.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (typeof window === "undefined") return;
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus the active tab after a keyboard-driven change so screen
  // readers announce it. We deliberately do not move focus when the
  // change came from a click (the click already moved focus to the
  // button itself).
  useEffect(() => {
    if (!focusOnUpdateRef.current) return;
    focusOnUpdateRef.current = false;
    const el = tabRefs.current[activeIndex];
    el?.focus();
  }, [activeIndex]);

  const onTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!isTabNavKey(e.key)) return;
      e.preventDefault();
      const next = nextTabIndex(activeIndex, e.key, TAB_ORDER.length);
      if (next === activeIndex) return;
      focusOnUpdateRef.current = true;
      setActiveIndex(next);
    },
    [activeIndex],
  );

  const onTabClick = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const activeTab = TABS[activeIndex] ?? TABS[0];
  // Defensive: the index is always in range under normal flow because
  // it is sourced from TAB_ORDER. The fallback keeps TypeScript happy
  // when the tuple is ever empty.
  if (!activeTab) {
    throw new Error("Options screen has no tabs configured.");
  }

  return (
    <main
      className={styles.main}
      data-testid="options-page"
      style={mainOverrides}
    >
      <section className={styles.shell} aria-labelledby="options-title">
        <header className={styles.header}>
          <h1 className={styles.title} id="options-title">
            Options
          </h1>
          <p className={styles.subtitle}>
            Settings scaffold per GDD section 20. Use Left and Right to
            switch tabs. Press Escape to return to the title.
          </p>
        </header>

        <ul
          className={styles.tabs}
          role="tablist"
          aria-label="Options sections"
          data-testid="options-tablist"
        >
          {TABS.map((tab, index) => {
            const selected = index === activeIndex;
            return (
              <li key={tab.key} role="presentation">
                <button
                  type="button"
                  role="tab"
                  id={`options-tab-${tab.key}`}
                  aria-selected={selected}
                  aria-controls={`options-panel-${tab.key}`}
                  data-testid={`options-tab-${tab.key}`}
                  data-active={selected ? "true" : "false"}
                  tabIndex={selected ? 0 : -1}
                  className={`${styles.tab} ${selected ? styles.tabActive : ""}`.trim()}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  onClick={() => onTabClick(index)}
                  onKeyDown={onTabKeyDown}
                >
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>

        <section
          className={styles.panel}
          role="tabpanel"
          id={`options-panel-${activeTab.key}`}
          aria-labelledby={`options-tab-${activeTab.key}`}
          data-testid={`options-panel-${activeTab.key}`}
          data-active-tab={activeTab.key}
          tabIndex={0}
        >
          {activeTab.pane ? (
            activeTab.pane()
          ) : (
            <>
              <h2 className={styles.panelTitle}>{activeTab.headline}</h2>
              <p className={styles.panelBody}>{activeTab.body}</p>
              {activeTab.dotId ? (
                <p
                  className={styles.dotRef}
                  data-testid={`options-panel-${activeTab.key}-dot`}
                >
                  Tracked by dot {activeTab.dotId}
                </p>
              ) : null}
            </>
          )}
        </section>

        <footer className={styles.footer}>
          <Link href="/" className={styles.backLink} data-testid="options-back">
            Back to title
          </Link>
          <button
            type="button"
            className={styles.resetButton}
            data-testid="options-reset-defaults"
            disabled
            aria-disabled="true"
            title={`Disabled until ${RESET_PENDING_DOT} ships the v2 settings schema.`}
          >
            Reset to defaults
          </button>
        </footer>
      </section>
    </main>
  );
}

const mainOverrides: CSSProperties = {
  // Inline override keeps the scaffold visible against the title-screen
  // dark theme even before per-route theming lands.
  background: "var(--bg, #111)",
};
