import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { FinalCarRecord } from "@/game/raceRules";

import { FinishingOrderTable } from "../FinishingOrderTable";

const finishedRow: FinalCarRecord = {
  carId: "player",
  status: "finished",
  raceTimeMs: 65_432,
  bestLapMs: 32_716,
};

const dnfFuelRow: FinalCarRecord = {
  carId: "rival-a",
  status: "dnf",
  raceTimeMs: null,
  bestLapMs: null,
  dnfReason: "out-of-fuel",
};

const dnfWreckedRow: FinalCarRecord = {
  carId: "rival-b",
  status: "dnf",
  raceTimeMs: null,
  bestLapMs: null,
  dnfReason: "wrecked",
};

const dnfUnknownRow: FinalCarRecord = {
  carId: "rival-c",
  status: "dnf",
  raceTimeMs: null,
  bestLapMs: null,
};

function html(rows: ReadonlyArray<FinalCarRecord>): string {
  return renderToStaticMarkup(
    createElement(FinishingOrderTable, { rows, playerCarId: "player" }),
  );
}

describe("FinishingOrderTable DNF reason copy", () => {
  it("renders the friendly out-of-fuel label below the DNF marker", () => {
    const markup = html([finishedRow, dnfFuelRow]);
    expect(markup).toContain('data-testid="results-row-rival-a-dnf-reason"');
    expect(markup).toContain("Out of fuel");
    expect(markup).toContain('data-dnf-reason="out-of-fuel"');
  });

  it("renders friendly labels for other DNF reasons", () => {
    const markup = html([finishedRow, dnfWreckedRow]);
    expect(markup).toContain("Wrecked");
    expect(markup).toContain('data-dnf-reason="wrecked"');
  });

  it("omits the reason label when DNF reason is undefined", () => {
    const markup = html([finishedRow, dnfUnknownRow]);
    expect(markup).not.toContain("results-row-rival-c-dnf-reason");
    expect(markup).toContain("DNF");
  });

  it("does not render a reason label for finished rows", () => {
    const markup = html([finishedRow]);
    expect(markup).not.toContain("results-row-player-dnf-reason");
  });
});
