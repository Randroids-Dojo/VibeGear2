"use client";

/**
 * Race results screen per `docs/gdd/20-hud-and-ui-ux.md` Results screen
 * and `docs/gdd/05-core-gameplay-loop.md` (results sits between race and
 * garage in the inter-race loop).
 *
 * This page reads the canonical `RaceResult` from the session-storage
 * handoff (`raceResultStorage.ts`). The race route writes the result on
 * race finish; this page reads it on mount and renders the seven §20
 * fields plus two CTAs:
 *
 *   - Continue to Garage (default focus, primary action)
 *   - Rematch (stays on the same track)
 *
 * Direct navigation with no handoff renders a soft-warning fallback
 * with a link back to the title screen. The fallback uses a separate
 * data-testid so Playwright can branch.
 *
 * Keyboard navigation:
 *   - Tab through the CTAs.
 *   - Enter activates the focused CTA. Continue is the default focus
 *     per the §20 default-focus convention.
 *
 * Wrapped in `<ErrorBoundary>` so a malformed result payload falls
 * through to the recovery UI instead of leaving a blank page.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { BonusChip } from "@/components/results/BonusChip";
import { DamageBar } from "@/components/results/DamageBar";
import { FinishingOrderTable } from "@/components/results/FinishingOrderTable";
import {
  clearRaceResult,
  loadRaceResult,
} from "@/components/results/raceResultStorage";
import type { RaceResult } from "@/game/raceResult";

export default function RaceResultsPage(): ReactElement {
  return (
    <ErrorBoundary>
      <ResultsShell />
    </ErrorBoundary>
  );
}

function ResultsShell(): ReactElement {
  const router = useRouter();
  // Hydration-safe pattern: reading sessionStorage at render time would
  // mismatch the SSR snapshot. Defer the read to a client-only effect.
  const [result, setResult] = useState<RaceResult | null | "loading">("loading");
  const continueRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setResult(loadRaceResult());
  }, []);

  // Default focus on Continue once the result resolves; mirrors the
  // pause overlay's resume-focus pattern.
  useEffect(() => {
    if (result && result !== "loading") {
      continueRef.current?.focus();
    }
  }, [result]);

  const handleRematch = useCallback(() => {
    if (result === "loading" || result === null) return;
    clearRaceResult();
    router.push(`/race?track=${encodeURIComponent(result.trackId)}`);
  }, [result, router]);

  if (result === "loading") {
    return (
      <main data-testid="race-results-loading" style={shellStyle}>
        Loading results...
      </main>
    );
  }

  if (result === null) {
    return <NoResultFallback />;
  }

  return <ResultsView result={result} onRematch={handleRematch} continueRef={continueRef} />;
}

interface ResultsViewProps {
  result: RaceResult;
  onRematch: () => void;
  continueRef: React.Ref<HTMLAnchorElement>;
}

function ResultsView(props: ResultsViewProps): ReactElement {
  const { result, onRematch, continueRef } = props;

  const placementLabel = useMemo(() => {
    if (result.playerPlacement === null) {
      return "Did Not Finish";
    }
    return `${ordinal(result.playerPlacement)} of ${result.finishingOrder.length}`;
  }, [result.playerPlacement, result.finishingOrder.length]);

  const fastestLabel = useMemo(() => {
    if (!result.fastestLap) return "No timed lap";
    return `${result.fastestLap.carId} | lap ${result.fastestLap.lapNumber} | ${formatMs(
      result.fastestLap.lapMs,
    )}`;
  }, [result.fastestLap]);

  return (
    <main
      data-testid="race-results"
      data-track={result.trackId}
      style={shellStyle}
    >
      <header style={bannerStyle} data-testid="results-banner">
        <h1 style={bannerTitle}>Race result</h1>
        <p data-testid="results-placement" style={placementStyle}>
          {placementLabel}
        </p>
      </header>

      <section style={splitStyle}>
        <div style={panelStyle} data-testid="results-standings-panel">
          <h2 style={panelHeading}>Finishing order</h2>
          <FinishingOrderTable
            rows={result.finishingOrder}
            playerCarId={result.playerCarId}
          />
        </div>

        <div style={panelStyle} data-testid="results-rewards-panel">
          <h2 style={panelHeading}>Rewards</h2>
          <dl style={rewardsListStyle}>
            <dt style={dtStyle}>Points earned</dt>
            <dd data-testid="results-points" style={ddStyle}>
              {result.pointsEarned}
            </dd>
            <dt style={dtStyle}>Cash earned</dt>
            <dd data-testid="results-cash" style={ddStyle}>
              {result.cashEarned.toLocaleString("en-US")} cr
            </dd>
            <dt style={dtStyle}>Cash from place</dt>
            <dd data-testid="results-cash-base" style={ddStyle}>
              {result.cashBaseEarned.toLocaleString("en-US")} cr
            </dd>
          </dl>

          <h3 style={subHeading}>Bonuses</h3>
          <div style={bonusesStyle} data-testid="results-bonuses">
            {result.bonuses.length === 0 ? (
              <p data-testid="results-no-bonuses" style={emptyStyle}>
                No bonuses awarded.
              </p>
            ) : (
              result.bonuses.map((bonus) => (
                <BonusChip key={bonus.kind} bonus={bonus} />
              ))
            )}
          </div>

          <h3 style={subHeading}>Damage taken</h3>
          <DamageBar delta={result.damageTaken} />

          <h3 style={subHeading}>Fastest lap</h3>
          <p data-testid="results-fastest-lap" style={fastestStyle}>
            {fastestLabel}
          </p>

          <h3 style={subHeading}>Next race</h3>
          {result.nextRace ? (
            <p data-testid="results-next-race" style={nextStyle}>
              {result.nextRace.trackId} ({result.nextRace.laps} laps)
            </p>
          ) : (
            <p data-testid="results-no-next-race" style={emptyStyle}>
              No upcoming race scheduled.
            </p>
          )}
        </div>
      </section>

      <nav style={ctaRowStyle} aria-label="Results actions">
        <Link
          href="/garage/cars"
          ref={continueRef}
          data-testid="results-cta-continue"
          style={primaryCtaStyle}
          onClick={() => clearRaceResult()}
        >
          Continue to Garage
        </Link>
        <button
          type="button"
          onClick={onRematch}
          data-testid="results-cta-rematch"
          style={secondaryCtaStyle}
        >
          Rematch
        </button>
      </nav>
    </main>
  );
}

function NoResultFallback(): ReactElement {
  return (
    <main data-testid="race-results-empty" style={shellStyle}>
      <header style={bannerStyle}>
        <h1 style={bannerTitle}>No race result</h1>
        <p style={placementStyle}>
          Open this page directly after finishing a race to see your standings.
        </p>
      </header>
      <nav style={ctaRowStyle} aria-label="Results actions">
        <Link href="/" data-testid="results-cta-home" style={primaryCtaStyle}>
          Back to title
        </Link>
      </nav>
    </main>
  );
}

function ordinal(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "Did Not Finish";
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "--:--.---";
  const total = Math.round(ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function pad3(value: number): string {
  return value.toString().padStart(3, "0");
}

const shellStyle: CSSProperties = {
  padding: "1.5rem",
  fontFamily: "system-ui, sans-serif",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
  maxWidth: "60rem",
  margin: "0 auto",
};

const bannerStyle: CSSProperties = {
  textAlign: "center",
  borderBottom: "1px solid var(--muted, #444)",
  paddingBottom: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const bannerTitle: CSSProperties = {
  margin: 0,
  fontSize: "2rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const placementStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  color: "var(--accent, #6cf)",
};

const splitStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "1.5rem",
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--muted, #444)",
  borderRadius: "8px",
  padding: "1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
  background: "rgba(255,255,255,0.02)",
};

const panelHeading: CSSProperties = {
  margin: 0,
  fontSize: "1.1rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const subHeading: CSSProperties = {
  margin: "0.4rem 0 0.2rem 0",
  fontSize: "0.95rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--muted, #aaa)",
};

const rewardsListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "0.25rem 1rem",
  margin: 0,
};

const dtStyle: CSSProperties = {
  fontWeight: 500,
  color: "var(--muted, #aaa)",
};

const ddStyle: CSSProperties = {
  margin: 0,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const bonusesStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
};

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.85rem",
  color: "var(--muted, #888)",
  fontStyle: "italic",
};

const fastestStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const nextStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
};

const ctaRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.8rem",
  justifyContent: "center",
};

const primaryCtaStyle: CSSProperties = {
  background: "var(--accent, #6cf)",
  color: "#000",
  padding: "0.7rem 1.4rem",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: 600,
  fontFamily: "system-ui, sans-serif",
  border: "1px solid transparent",
};

const secondaryCtaStyle: CSSProperties = {
  background: "transparent",
  color: "var(--fg, #ddd)",
  padding: "0.7rem 1.4rem",
  borderRadius: "6px",
  fontFamily: "system-ui, sans-serif",
  fontSize: "1rem",
  border: "1px solid var(--muted, #888)",
  cursor: "pointer",
};
