"use client";

/**
 * Garage car selector.
 *
 * Lists every car in the MVP catalogue (`docs/gdd/11-cars-and-stats.md`)
 * with the §23 stat row, and lets the player switch their `activeCarId`.
 * Unowned cars surface a Buy affordance gated by current credits.
 *
 * Persistence: reads and writes the localStorage save via
 * `loadSave` / `saveSave`. Selecting a car or buying one is committed
 * synchronously; failures fall back to the in-memory state and surface
 * a status message.
 *
 * Edge cases per the §11 dot:
 * - The active car cannot be sold (this page does not expose selling at
 *   all; selling will live alongside the upgrade UI in a later slice).
 * - `purchasePrice: 0` cars are starter granted on new save.
 * - Stat values are validated by `CarSchema` and the content test, so the
 *   UI can render `baseStats` directly without extra range checks.
 */

import type { CSSProperties, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CARS, getCar } from "@/data/cars";
import type { Car, CarBaseStats, SaveGame } from "@/data/schemas";
import { defaultSave, loadSave, saveSave } from "@/persistence";

interface PageStatus {
  kind: "idle" | "info" | "error";
  message: string;
}

const STAT_LABELS: ReadonlyArray<readonly [keyof CarBaseStats, string]> = [
  ["topSpeed", "Top speed"],
  ["accel", "Accel"],
  ["brake", "Brake"],
  ["gripDry", "Grip (dry)"],
  ["gripWet", "Grip (wet)"],
  ["stability", "Stability"],
  ["durability", "Durability"],
  ["nitroEfficiency", "Nitro eff."],
];

export default function GarageCarsPage() {
  const [save, setSave] = useState<SaveGame | null>(null);
  const [status, setStatus] = useState<PageStatus>({
    kind: "idle",
    message: "",
  });

  // Hydrate from localStorage after mount so we do not touch storage on
  // the server during static generation.
  useEffect(() => {
    const outcome = loadSave();
    if (outcome.kind === "loaded") {
      setSave(outcome.save);
    } else {
      setSave(defaultSave());
      if (outcome.reason !== "missing" && outcome.reason !== "no-storage") {
        setStatus({
          kind: "info",
          message: `Loaded default save (reason: ${outcome.reason}).`,
        });
      }
    }
  }, []);

  const ownedCars = useMemo(
    () => new Set(save?.garage.ownedCars ?? []),
    [save],
  );

  const persist = useCallback((next: SaveGame, successMessage: string) => {
    setSave(next);
    const result = saveSave(next);
    if (result.kind === "ok") {
      setStatus({ kind: "info", message: successMessage });
    } else {
      setStatus({
        kind: "error",
        message: `Save failed (${result.reason}); change kept in memory only.`,
      });
    }
  }, []);

  const selectCar = useCallback(
    (carId: string) => {
      if (!save) return;
      if (!ownedCars.has(carId)) return;
      if (save.garage.activeCarId === carId) return;
      const next: SaveGame = {
        ...save,
        garage: { ...save.garage, activeCarId: carId },
      };
      persist(next, `Active car set to ${getCar(carId)?.name ?? carId}.`);
    },
    [ownedCars, persist, save],
  );

  const buyCar = useCallback(
    (carId: string) => {
      if (!save) return;
      if (ownedCars.has(carId)) return;
      const car = getCar(carId);
      if (!car) return;
      if (save.garage.credits < car.purchasePrice) {
        setStatus({
          kind: "error",
          message: `Not enough credits for ${car.name} (needs ${car.purchasePrice}, have ${save.garage.credits}).`,
        });
        return;
      }
      const next: SaveGame = {
        ...save,
        garage: {
          ...save.garage,
          credits: save.garage.credits - car.purchasePrice,
          ownedCars: [...save.garage.ownedCars, car.id],
          installedUpgrades: {
            ...save.garage.installedUpgrades,
            [car.id]: {
              engine: 0,
              gearbox: 0,
              dryTires: 0,
              wetTires: 0,
              nitro: 0,
              armor: 0,
              cooling: 0,
              aero: 0,
            },
          },
        },
      };
      persist(next, `Purchased ${car.name}.`);
    },
    [ownedCars, persist, save],
  );

  if (!save) {
    return (
      <main style={pageStyle}>
        <h1>Garage. Car selector</h1>
        <p data-testid="garage-loading">Loading garage</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>Garage. Car selector</h1>
        <p style={{ color: "var(--muted, #aaa)", margin: 0 }}>
          Per GDD §11. Active car: <strong data-testid="active-car-id">{save.garage.activeCarId}</strong>.
          Credits: <strong data-testid="garage-credits">{save.garage.credits}</strong>.
        </p>
        {status.kind !== "idle" ? (
          <p
            data-testid="garage-status"
            style={{
              marginTop: "0.5rem",
              color: status.kind === "error" ? "#f88" : "var(--accent, #8cf)",
            }}
          >
            {status.message}
          </p>
        ) : null}
      </header>
      <ul style={listStyle} data-testid="car-list">
        {CARS.map((car) => (
          <CarCard
            key={car.id}
            car={car}
            owned={ownedCars.has(car.id)}
            active={save.garage.activeCarId === car.id}
            credits={save.garage.credits}
            onSelect={() => selectCar(car.id)}
            onBuy={() => buyCar(car.id)}
          />
        ))}
      </ul>
    </main>
  );
}

interface CarCardProps {
  car: Car;
  owned: boolean;
  active: boolean;
  credits: number;
  onSelect: () => void;
  onBuy: () => void;
}

function CarCard({
  car,
  owned,
  active,
  credits,
  onSelect,
  onBuy,
}: CarCardProps): ReactElement {
  const canAfford = credits >= car.purchasePrice;
  const action = owned ? (
    <button
      type="button"
      disabled={active}
      onClick={onSelect}
      data-testid={`select-${car.id}`}
      style={buttonStyle(active)}
    >
      {active ? "Active" : "Set Active"}
    </button>
  ) : (
    <button
      type="button"
      disabled={!canAfford}
      onClick={onBuy}
      data-testid={`buy-${car.id}`}
      style={buttonStyle(false)}
      title={canAfford ? "" : "Not enough credits"}
    >
      Buy ({car.purchasePrice})
    </button>
  );

  return (
    <li style={cardStyle(active)} data-testid={`car-card-${car.id}`}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{car.name}</h2>
          <p style={{ margin: 0, color: "var(--muted, #aaa)", fontSize: "0.875rem" }}>
            Class: <span data-testid={`class-${car.id}`}>{car.class}</span>. Repair x{car.repairFactor.toFixed(2)}.
          </p>
        </div>
        {action}
      </header>
      <dl style={statGridStyle}>
        {STAT_LABELS.map(([key, label]) => (
          <div key={key} style={{ display: "contents" }}>
            <dt style={{ color: "var(--muted, #aaa)" }}>{label}</dt>
            <dd
              style={{ margin: 0, textAlign: "right" }}
              data-testid={`stat-${car.id}-${key}`}
            >
              {formatStat(car.baseStats[key])}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function formatStat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
}

const pageStyle: CSSProperties = {
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
  color: "var(--fg, #ddd)",
  background: "var(--bg, #111)",
  minHeight: "100vh",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(20rem, 1fr))",
  gap: "1rem",
};

function cardStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? "var(--accent, #8cf)" : "var(--muted, #444)"}`,
    borderRadius: "8px",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    background: active ? "rgba(140, 200, 255, 0.06)" : "transparent",
  };
}

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    background: "transparent",
    color: "var(--fg, #ddd)",
    border: "1px solid var(--muted, #888)",
    borderRadius: "6px",
    padding: "0.5rem 0.75rem",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    minWidth: "7rem",
  };
}

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  rowGap: "0.15rem",
  columnGap: "1rem",
  margin: 0,
};
