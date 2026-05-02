"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import { TRACK_IDS, TRACK_RAW, getChampionship } from "@/data";
import {
  TrackSchema,
  WeatherOptionSchema,
  type SaveGame,
  type WeatherOption,
} from "@/data/schemas";
import {
  buildPreRaceCard,
  recommendTire,
  resolveWeatherSelection,
  type PreRaceCard,
} from "@/game/preRaceCard";
import type { TireKind } from "@/game/weather";
import { loadSave } from "@/persistence/save";

const CHAMPIONSHIP_ID = "world-tour-standard";

export default function RacePrepPage(): ReactElement {
  return (
    <Suspense fallback={<RacePrepLoading />}>
      <RacePrepShell />
    </Suspense>
  );
}

function RacePrepLoading(): ReactElement {
  return (
    <main style={pageStyle} data-testid="pre-race-page">
      <h1>Pre-race</h1>
      <p data-testid="pre-race-loading">Loading pre-race card</p>
    </main>
  );
}

function RacePrepShell(): ReactElement {
  const router = useRouter();
  const search = useSearchParams();
  const trackId = search?.get("track") ?? null;
  const tourId = search?.get("tour") ?? null;
  const raceIndexRaw = search?.get("raceIndex") ?? null;
  const requestedWeather = parseWeather(search?.get("weather") ?? null);
  const requestedTire = parseTire(search?.get("tire") ?? null);
  const [save, setSave] = useState<SaveGame | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const outcome = loadSave();
    if (outcome.kind === "loaded") {
      setSave(outcome.save);
      return;
    }
    setRedirecting(true);
    router.replace("/");
  }, [router]);

  const track = useMemo(() => {
    if (!trackId || !TRACK_IDS.includes(trackId)) return null;
    return TrackSchema.parse(TRACK_RAW[trackId]);
  }, [trackId]);

  const championship = useMemo(() => getChampionship(CHAMPIONSHIP_ID), []);
  const raceIndex = parseRaceIndex(raceIndexRaw);
  const initialWeather = useMemo(
    () => (track ? resolveWeatherSelection(track, requestedWeather) : "clear"),
    [requestedWeather, track],
  );
  const [weather, setWeather] = useState<WeatherOption>(initialWeather);
  const [selectedTire, setSelectedTire] = useState<TireKind>(
    requestedTire ?? recommendTire(initialWeather),
  );

  useEffect(() => {
    setWeather(initialWeather);
    setSelectedTire(requestedTire ?? recommendTire(initialWeather));
  }, [initialWeather, requestedTire]);

  const card: PreRaceCard | null = useMemo(() => {
    if (!save || !track) return null;
    return buildPreRaceCard({
      track,
      save,
      championship,
      tourId,
      raceIndex,
      weatherSelection: weather,
      selectedTire,
    });
  }, [championship, raceIndex, save, selectedTire, tourId, track, weather]);

  if (redirecting) {
    return (
      <main style={pageStyle} data-testid="pre-race-page">
        <h1>Pre-race</h1>
        <p data-testid="pre-race-redirect">Create or load a profile first.</p>
      </main>
    );
  }

  if (!save) {
    return <RacePrepLoading />;
  }

  if (!trackId || !track || !card) {
    return (
      <main style={pageStyle} data-testid="pre-race-page">
        <h1>Pre-race</h1>
        <p data-testid="pre-race-error">Race setup is unavailable.</p>
        <Link href="/world" style={linkStyle}>
          Back to world tour
        </Link>
      </main>
    );
  }

  const startHref = raceHref({
    trackId,
    weather,
    tire: selectedTire,
    tourId,
    raceIndex,
  });

  return (
    <main style={pageStyle} data-testid="pre-race-page">
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle} data-testid="pre-race-tour">
            {card.tourName}
          </p>
          <h1 style={titleStyle} data-testid="pre-race-track">
            {card.trackName}
          </h1>
        </div>
        <nav style={navStyle} aria-label="Pre-race actions">
          <Link href="/garage" style={linkStyle}>
            Garage
          </Link>
          <Link href="/world" style={linkStyle}>
            World
          </Link>
        </nav>
      </header>

      <section style={gridStyle} aria-label="Race briefing">
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Track card</h2>
          <dl style={summaryGridStyle}>
            <Field label="Laps" testId="pre-race-laps" value={card.laps} />
            <Field
              label="Difficulty"
              testId="pre-race-difficulty"
              value={`${card.difficulty.value} (${card.difficulty.label})`}
            />
            <Field
              label="Base reward"
              testId="pre-race-base-reward"
              value={card.baseReward}
            />
            <Field
              label="Standings"
              testId="pre-race-standings"
              value={card.standings}
            />
          </dl>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Forecast</h2>
          <label style={fieldLabelStyle} htmlFor="weather-select">
            Weather
          </label>
          <select
            id="weather-select"
            value={weather}
            onChange={(event) => {
              const next = parseWeather(event.target.value) ?? card.weather;
              setWeather(next);
              setSelectedTire(recommendTire(next));
            }}
            style={selectStyle}
            data-testid="pre-race-weather-select"
          >
            {card.allowedWeather.map((option) => (
              <option key={option} value={option}>
                {optionLabel(option)}
              </option>
            ))}
          </select>
          <dl style={summaryGridStyle}>
            <Field
              label="Condition"
              testId="pre-race-weather"
              value={card.forecast.condition}
            />
            <Field
              label="Surface temp"
              testId="pre-race-surface-temp"
              value={card.forecast.surfaceTemperatureBand}
            />
            <Field
              label="Grip"
              testId="pre-race-grip"
              value={card.forecast.gripRating}
            />
            <Field
              label="Visibility"
              testId="pre-race-visibility"
              value={card.forecast.visibilityRating}
            />
          </dl>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Tires</h2>
          <p
            style={recommendationStyle}
            data-testid="pre-race-recommended-tire"
          >
            Recommended: {card.recommendedTire}
          </p>
          <div style={segmentedStyle} role="group" aria-label="Tire choice">
            {(["dry", "wet"] as const).map((tire) => (
              <button
                key={tire}
                type="button"
                style={
                  selectedTire === tire ? activeSegmentStyle : segmentStyle
                }
                aria-pressed={selectedTire === tire}
                onClick={() => setSelectedTire(tire)}
                data-testid={`pre-race-tire-${tire}`}
              >
                {tire}
              </button>
            ))}
          </div>
          <p
            style={{
              ...mutedTextStyle,
              color: card.selectedTireWarning ? "#ffd166" : "#aab0bd",
            }}
            data-testid="pre-race-tire-warning"
          >
            {card.selectedTireWarning || "Tire choice matches the forecast."}
          </p>
        </article>

        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>Car and economy</h2>
          <dl style={summaryGridStyle}>
            <Field
              label="Selected car"
              testId="pre-race-car"
              value={card.carSummary.name}
            />
            <Field
              label="Class"
              testId="pre-race-car-class"
              value={card.carSummary.className}
            />
            <Field
              label="Setup"
              testId="pre-race-setup"
              value={card.setupSummary}
            />
            <Field
              label="Cash"
              testId="pre-race-cash"
              value={card.cashOnHand}
            />
            <Field
              label="Repair estimate"
              testId="pre-race-repair-estimate"
              value={card.repairEstimate}
            />
          </dl>
        </article>

        {card.tourPressure ? (
          <article style={panelStyle} data-testid="pre-race-tour-pressure">
            <h2 style={sectionTitleStyle}>Tour pressure</h2>
            <dl style={summaryGridStyle}>
              <Field
                label="Standing"
                testId="pre-race-pressure-standing"
                value={card.tourPressure.standingsLabel}
              />
              <Field
                label="Gate"
                testId="pre-race-pressure-gate"
                value={card.tourPressure.gateLabel}
              />
              <Field
                label="Plan"
                testId="pre-race-pressure-plan"
                value={card.tourPressure.pressureLabel}
              />
              <Field
                label="After repairs"
                testId="pre-race-pressure-cash-after-repair"
                value={`${card.tourPressure.cashAfterRepair} cr`}
              />
              <Field
                label="Next upgrade"
                testId="pre-race-pressure-next-upgrade"
                value={
                  card.tourPressure.nextUpgradeCost === null
                    ? card.tourPressure.nextUpgradeLabel
                    : `${card.tourPressure.nextUpgradeLabel} (${card.tourPressure.nextUpgradeCost} cr)`
                }
              />
              <Field
                label="Shortfall"
                testId="pre-race-pressure-upgrade-shortfall"
                value={`${card.tourPressure.upgradeShortfall} cr`}
              />
            </dl>
          </article>
        ) : null}
      </section>

      <footer style={footerStyle}>
        <Link
          href={startHref}
          style={primaryLinkStyle}
          data-testid="pre-race-start-link"
        >
          Start race
        </Link>
      </footer>
    </main>
  );
}

function Field({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly testId: string;
}): ReactElement {
  return (
    <div style={summaryRowStyle}>
      <dt>{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </div>
  );
}

function parseWeather(raw: string | null): WeatherOption | null {
  const parsed = WeatherOptionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseTire(raw: string | null): TireKind | null {
  return raw === "dry" || raw === "wet" ? raw : null;
}

function parseRaceIndex(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function raceHref(input: {
  readonly trackId: string;
  readonly weather: WeatherOption;
  readonly tire: TireKind;
  readonly tourId: string | null;
  readonly raceIndex: number | null;
}): string {
  const params = new URLSearchParams({
    track: input.trackId,
    weather: input.weather,
    tire: input.tire,
  });
  if (input.tourId) params.set("tour", input.tourId);
  if (input.raceIndex !== null)
    params.set("raceIndex", String(input.raceIndex));
  return `/race?${params.toString()}`;
}

function optionLabel(weather: WeatherOption): string {
  return weather
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "2rem",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  fontFamily: "system-ui, sans-serif",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  marginBottom: "1.5rem",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#9bd2ff",
  fontWeight: 700,
};

const titleStyle: CSSProperties = {
  margin: "0.25rem 0 0",
  fontSize: "2rem",
};

const navStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const linkStyle: CSSProperties = {
  color: "#dfe8ff",
  border: "1px solid #4f5f7a",
  borderRadius: "0.5rem",
  padding: "0.6rem 0.85rem",
  textDecoration: "none",
};

const primaryLinkStyle: CSSProperties = {
  ...linkStyle,
  display: "inline-flex",
  justifyContent: "center",
  minWidth: "10rem",
  color: "#081018",
  background: "#ffd166",
  borderColor: "#ffd166",
  fontWeight: 800,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
  gap: "1rem",
};

const panelStyle: CSSProperties = {
  border: "1px solid #2e3c55",
  borderRadius: "0.5rem",
  padding: "1rem",
  background: "#141b28",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "1.1rem",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gap: "0.6rem",
  margin: 0,
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  alignItems: "baseline",
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: "0.35rem",
  color: "#aab0bd",
};

const selectStyle: CSSProperties = {
  width: "100%",
  marginBottom: "1rem",
  padding: "0.6rem",
  color: "#e8edf8",
  background: "#0d1320",
  border: "1px solid #40506b",
  borderRadius: "0.35rem",
};

const recommendationStyle: CSSProperties = {
  margin: "0 0 1rem",
  fontSize: "1.2rem",
  fontWeight: 800,
};

const segmentedStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.5rem",
  marginBottom: "0.8rem",
};

const segmentStyle: CSSProperties = {
  padding: "0.65rem",
  color: "#dfe8ff",
  background: "#0d1320",
  border: "1px solid #40506b",
  borderRadius: "0.35rem",
  textTransform: "uppercase",
  fontWeight: 800,
};

const activeSegmentStyle: CSSProperties = {
  ...segmentStyle,
  color: "#081018",
  background: "#9bd2ff",
  borderColor: "#9bd2ff",
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: "#aab0bd",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "1.5rem",
};
