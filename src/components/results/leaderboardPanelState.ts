/**
 * Pure state model for the §21 leaderboard panel rendered on the §20
 * results screen.
 *
 * The panel is the consumer the F-032 dot calls for. The leaderboard
 * client (`src/leaderboard/client.ts`) ships a discriminated-union
 * sentinel for both `submitLap` and `getTop`; this module owns the
 * mapping from those sentinels to a tiny status-pill model the
 * `LeaderboardPanel` React component renders without any branching of
 * its own.
 *
 * Why split a state model out of the component: the existing pause /
 * difficulty / accessibility panes follow the same pattern. The repo
 * has no `@testing-library/react` dependency; tests cover the state
 * model directly with literal fixtures, and the SSR shell is checked
 * with `renderToStaticMarkup`. Interactive flows belong in Playwright.
 *
 * Scope: this slice covers the player's own submission status pill and
 * the optional top-N panel. DNF entries do not submit a row (per the
 * dot scope: "when the player crosses the finish line cleanly, status
 * = 'finished'"). A future slice can add ghost-mode interplay; the
 * model intentionally has no hook for that yet so the call site stays
 * one branch.
 */

import type {
  GetTopResult,
  SubmitLapResult,
} from "@/leaderboard/client";
import type { LeaderboardEntry } from "@/leaderboard/types";

/**
 * The four player-facing status codes the panel renders as a pill.
 *
 *   - `idle`: the page just mounted; the panel has not yet called
 *     `submitLap`. Renders a neutral "Submitting..." pill so the user
 *     sees the request is in flight.
 *   - `dnf`: the player did not finish; the panel skips the network
 *     call and renders "Lap not submitted" so the receipt is honest
 *     about why the leaderboard row is absent.
 *   - `stored`: the server accepted the submission. Renders "Lap saved"
 *     plus the optional opaque id (the noop store returns `null`).
 *   - `rejected`: the server returned a 4xx. Renders "Lap rejected"
 *     plus the stable `code` so a developer reading the page knows
 *     why (e.g. `bad-signature`, `lap-too-fast`).
 *   - `error`: network failure. Renders "Leaderboard offline" so the
 *     player understands the lap was not stored but the race result is
 *     still valid.
 *   - `disabled`: the feature flag is off but the panel was rendered
 *     anyway (test fixtures hit this branch). Mirrors the client
 *     adapter's `disabled` sentinel.
 *
 * Stable string codes the e2e and unit tests can assert against
 * without parsing prose; the React component derives the visible label
 * from the status via `submitLabel`.
 */
export type PanelStatus =
  | "idle"
  | "dnf"
  | "stored"
  | "rejected"
  | "error"
  | "disabled";

/**
 * The render shape consumed by `<LeaderboardPanel />`. Pure; no
 * promises, no fetch handles. Building this view is a one-shot
 * `useMemo` against the inputs the page already has.
 */
export interface LeaderboardPanelView {
  status: PanelStatus;
  /** Stable label the pill renders. Always non-empty. */
  label: string;
  /** Server-issued row id when `status === "stored"`, else `null`. */
  storedId: string | null;
  /**
   * Server `code` string when `status === "rejected"`. Lets the e2e
   * assert on the wire-shape rather than prose.
   */
  rejectedCode: string | null;
  /**
   * Top-N rows when the optional read returned `entries`. Empty when
   * the read is disabled, errored, or has not fired yet.
   */
  entries: ReadonlyArray<LeaderboardEntry>;
  /**
   * `true` when the panel should hide the top-N section entirely
   * (read disabled, never fired, or errored). The UI shows the status
   * pill alone in that case.
   */
  topHidden: boolean;
}

/**
 * Translate a `SubmitLapResult` from the leaderboard client into the
 * panel's `status` + label. Pure: a fixture in -> a deterministic view
 * out, with no IO of any kind.
 *
 * The `playerFinished` flag short-circuits the model so DNF rows never
 * surface a pill that implies a submission was attempted (the panel
 * still renders `dnf` so the receipt is honest, not blank).
 */
export function deriveSubmitView(
  result: SubmitLapResult | null,
  playerFinished: boolean,
): {
  status: PanelStatus;
  label: string;
  storedId: string | null;
  rejectedCode: string | null;
} {
  if (!playerFinished) {
    return {
      status: "dnf",
      label: "Lap not submitted (DNF).",
      storedId: null,
      rejectedCode: null,
    };
  }
  if (result === null) {
    return {
      status: "idle",
      label: "Submitting lap...",
      storedId: null,
      rejectedCode: null,
    };
  }
  switch (result.kind) {
    case "disabled":
      return {
        status: "disabled",
        label: "Leaderboard disabled.",
        storedId: null,
        rejectedCode: null,
      };
    case "stored":
      return {
        status: "stored",
        label:
          result.id === null ? "Lap saved." : `Lap saved (id ${result.id}).`,
        storedId: result.id,
        rejectedCode: null,
      };
    case "rejected":
      return {
        status: "rejected",
        label: `Lap rejected (${result.code}).`,
        storedId: null,
        rejectedCode: result.code,
      };
    case "network-error":
      return {
        status: "error",
        label: "Leaderboard offline.",
        storedId: null,
        rejectedCode: null,
      };
  }
}

/**
 * Translate a `GetTopResult` into the panel's top-N section. Pure.
 *
 * `topHidden` is `true` for every non-`entries` branch so the UI shows
 * the status pill alone; the optional read never breaks the layout
 * when the backend is offline or the trackId was rejected.
 */
export function deriveTopView(result: GetTopResult | null): {
  entries: ReadonlyArray<LeaderboardEntry>;
  topHidden: boolean;
} {
  if (result === null || result.kind !== "entries") {
    return { entries: [], topHidden: true };
  }
  return { entries: result.entries, topHidden: false };
}

/**
 * Compose the two derivations into the full panel view. Called once
 * per render by the React component; kept pure so the unit tests can
 * pin every branch with literal fixtures.
 */
export function buildLeaderboardPanelView(input: {
  submit: SubmitLapResult | null;
  top: GetTopResult | null;
  playerFinished: boolean;
}): LeaderboardPanelView {
  const submit = deriveSubmitView(input.submit, input.playerFinished);
  const top = deriveTopView(input.top);
  return {
    status: submit.status,
    label: submit.label,
    storedId: submit.storedId,
    rejectedCode: submit.rejectedCode,
    entries: top.entries,
    topHidden: top.topHidden,
  };
}
