"use client";

/**
 * F-096 slice 1 title-screen surface. Renders one text badge per
 * unlocked cosmetic on the title page so a player who finishes a
 * tour gets a visible "you earned this" cue between sessions.
 *
 * Hydration-safe: SSR pass renders an empty placeholder so the
 * static markup always carries the test-id; the client-only effect
 * loads the save and populates the row after mount. No animation;
 * the row is static so the surface respects vestibular sensitivity
 * per §19.
 *
 * Out of scope (F-096 follow-up slices, deferred):
 *   - Sprite-based badge icons (slice 1 is text-only labels).
 *   - Player car livery `paletteRecolour` overlay.
 *   - Soundtrack-remix rotation in the music runtime.
 */

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import { buildCosmeticBadges, type CosmeticBadge } from "@/game/cosmetics";
import { loadSave } from "@/persistence/save";

export function CosmeticBadgeRow(): ReactElement {
  const [badges, setBadges] = useState<readonly CosmeticBadge[] | null>(null);

  useEffect(() => {
    const outcome = loadSave();
    const save = outcome.kind === "loaded" ? outcome.save : null;
    setBadges(buildCosmeticBadges(save?.unlockedCosmetics));
  }, []);

  if (badges === null) {
    return (
      <div
        data-testid="cosmetic-badge-row"
        data-state="hydrating"
        style={hiddenStyle}
        aria-hidden="true"
      />
    );
  }

  if (badges.length === 0) {
    return (
      <div
        data-testid="cosmetic-badge-row"
        data-state="empty"
        style={hiddenStyle}
        aria-hidden="true"
      />
    );
  }

  return (
    <ul
      data-testid="cosmetic-badge-row"
      data-state="ready"
      aria-label="Unlocked cosmetics"
      style={rowStyle}
    >
      {badges.map((badge) => (
        <li
          key={badge.cosmeticId}
          data-testid={`cosmetic-badge-${badge.cosmeticId}`}
          style={badgeStyle}
        >
          {badge.label}
        </li>
      ))}
    </ul>
  );
}

const hiddenStyle: CSSProperties = {
  display: "none",
};

const rowStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0.75rem 0 0",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
  justifyContent: "center",
};

const badgeStyle: CSSProperties = {
  fontSize: "0.78rem",
  letterSpacing: "0.02em",
  padding: "0.25rem 0.6rem",
  border: "1px solid #2a2f3d",
  borderRadius: "999px",
  background: "rgba(20, 26, 38, 0.6)",
  color: "#cfd4e0",
};
