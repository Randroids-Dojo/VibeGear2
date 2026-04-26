/**
 * Unit coverage for the §21 leaderboard panel state model.
 *
 * The repo has no `@testing-library/react` dependency, so the React
 * component (`LeaderboardPanel.tsx`) is exercised by an SSR-shape
 * snapshot test and the interactive flows belong in Playwright. This
 * suite pins every branch of `deriveSubmitView` / `deriveTopView` /
 * `buildLeaderboardPanelView` with literal fixtures so the four
 * `submitLap` outcomes (`stored`, `rejected`, `network-error`,
 * `disabled`) plus the DNF and idle short-circuits each render the
 * stable `status` + `label` the panel renders.
 */

import { describe, expect, it } from "vitest";

import type { GetTopResult, SubmitLapResult } from "@/leaderboard/client";
import type { LeaderboardEntry } from "@/leaderboard/types";

import {
  buildLeaderboardPanelView,
  deriveSubmitView,
  deriveTopView,
} from "../leaderboardPanelState";

const STORED: SubmitLapResult = { kind: "stored", id: "row-42" };
const STORED_NULL_ID: SubmitLapResult = { kind: "stored", id: null };
const DISABLED: SubmitLapResult = { kind: "disabled" };
const REJECTED: SubmitLapResult = {
  kind: "rejected",
  status: 401,
  code: "bad-signature",
};
const NETWORK_ERROR: SubmitLapResult = {
  kind: "network-error",
  reason: "fetch failed",
};

const ENTRY: LeaderboardEntry = {
  id: "row-1",
  trackId: "test/straight",
  carId: "sparrow-gt",
  lapMs: 67_450,
  playerName: "RAN",
  submittedAt: 1_700_000_000_000,
};

describe("deriveSubmitView", () => {
  it("returns the dnf short-circuit when the player did not finish", () => {
    expect(deriveSubmitView(STORED, false)).toEqual({
      status: "dnf",
      label: "Lap not submitted (DNF).",
      storedId: null,
      rejectedCode: null,
    });
  });

  it("returns the idle pill before submitLap resolves", () => {
    expect(deriveSubmitView(null, true)).toEqual({
      status: "idle",
      label: "Submitting lap...",
      storedId: null,
      rejectedCode: null,
    });
  });

  it("renders the stored sentinel with the row id when present", () => {
    expect(deriveSubmitView(STORED, true)).toEqual({
      status: "stored",
      label: "Lap saved (id row-42).",
      storedId: "row-42",
      rejectedCode: null,
    });
  });

  it("renders the stored sentinel without an id when the noop store omits it", () => {
    expect(deriveSubmitView(STORED_NULL_ID, true)).toEqual({
      status: "stored",
      label: "Lap saved.",
      storedId: null,
      rejectedCode: null,
    });
  });

  it("renders the rejected sentinel with the server code", () => {
    expect(deriveSubmitView(REJECTED, true)).toEqual({
      status: "rejected",
      label: "Lap rejected (bad-signature).",
      storedId: null,
      rejectedCode: "bad-signature",
    });
  });

  it("renders the network-error sentinel as offline", () => {
    expect(deriveSubmitView(NETWORK_ERROR, true)).toEqual({
      status: "error",
      label: "Leaderboard offline.",
      storedId: null,
      rejectedCode: null,
    });
  });

  it("renders the disabled sentinel when the client short-circuits", () => {
    expect(deriveSubmitView(DISABLED, true)).toEqual({
      status: "disabled",
      label: "Leaderboard disabled.",
      storedId: null,
      rejectedCode: null,
    });
  });
});

describe("deriveTopView", () => {
  it("hides the top section when the read has not fired", () => {
    expect(deriveTopView(null)).toEqual({ entries: [], topHidden: true });
  });

  it("hides the top section when the client returned disabled", () => {
    expect(deriveTopView({ kind: "disabled" })).toEqual({
      entries: [],
      topHidden: true,
    });
  });

  it("hides the top section on rejected reads", () => {
    expect(
      deriveTopView({ kind: "rejected", status: 404, code: "unknown-track" }),
    ).toEqual({ entries: [], topHidden: true });
  });

  it("hides the top section on network errors", () => {
    expect(
      deriveTopView({ kind: "network-error", reason: "fetch failed" }),
    ).toEqual({ entries: [], topHidden: true });
  });

  it("surfaces the entries when the read returns them", () => {
    const result: GetTopResult = { kind: "entries", entries: [ENTRY] };
    expect(deriveTopView(result)).toEqual({
      entries: [ENTRY],
      topHidden: false,
    });
  });
});

describe("buildLeaderboardPanelView", () => {
  it("composes both derivations into a single view", () => {
    const view = buildLeaderboardPanelView({
      submit: STORED,
      top: { kind: "entries", entries: [ENTRY] },
      playerFinished: true,
    });
    expect(view.status).toBe("stored");
    expect(view.label).toBe("Lap saved (id row-42).");
    expect(view.storedId).toBe("row-42");
    expect(view.rejectedCode).toBeNull();
    expect(view.entries).toEqual([ENTRY]);
    expect(view.topHidden).toBe(false);
  });

  it("hides the top section when the optional read is unset even on a stored submit", () => {
    const view = buildLeaderboardPanelView({
      submit: STORED,
      top: null,
      playerFinished: true,
    });
    expect(view.status).toBe("stored");
    expect(view.entries).toEqual([]);
    expect(view.topHidden).toBe(true);
  });

  it("treats a DNF as not-submitted regardless of the submit result", () => {
    const view = buildLeaderboardPanelView({
      submit: STORED,
      top: { kind: "entries", entries: [ENTRY] },
      playerFinished: false,
    });
    expect(view.status).toBe("dnf");
    expect(view.label).toBe("Lap not submitted (DNF).");
  });
});
