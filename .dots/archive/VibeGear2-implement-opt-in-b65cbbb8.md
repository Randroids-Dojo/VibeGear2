---
title: "implement: opt-in client error capture + global error boundary report path (no telemetry by default) per §27 + WORKING_AGREEMENT §11"
status: closed
priority: 4
issue-type: task
created-at: "\"\\\"2026-04-26T02:09:18.331804-05:00\\\"\""
closed-at: "2026-04-30T04:38:35.282755-05:00"
close-reason: "Merged PR #121, main CI green, CodeQL green, Vercel production deploy verified, and production smoke passed."
blocks:
  - VibeGear2-implement-cross-browser-7cf643ce
  - VibeGear2-implement-tagged-release-b3d30084
---

## Description

Add a single-file client error capture path that is **opt-in** and **emits no
network requests by default**. The capture path subscribes to
`window.onerror` and `window.onunhandledrejection`, collects a small
deduplicated ring buffer of recent errors keyed by stack-trace prefix, and
exposes them on a hidden dev panel reachable from the title screen via a
`?errors=1` query flag. A small adapter interface lets the dev later opt in
to a self-hosted sink (Sentry-compatible JSON over POST, or a plain
log endpoint) by setting an env var; without that env var, no third-party
network call is made.

## Context

WORKING_AGREEMENT.md §11 names "Adding paid third-party services or
telemetry" as an irreversible action that requires explicit dev confirmation.
GDD §27 "risks and mitigations" calls for hardening but does not name a
specific telemetry choice. Q-003 (deploy target) is still open; that decision
will pick the platform's built-in log surface, which may be enough by itself.
Until that decision lands, this slice ships the **error-capture mechanism**
without picking a sink.

Three goals:

1. **Find bugs the dev cannot reproduce.** A user on Safari hits a crash; the
   `?errors=1` panel lets them paste the recent error log into a GitHub
   issue. No telemetry, no consent dialog, no PII.
2. **Make the global error boundary actionable.**
   `implement-pause-overlay-265e9b56` adds a global error boundary; without
   this slice it just renders "something went wrong". With this slice it
   renders the captured stack and a "copy to clipboard" affordance.
3. **Lay the rails for an optional self-hosted sink later.** The adapter is
   an interface, not a concrete dependency; the dev can plumb a Sentry
   instance or a self-hosted endpoint behind it without touching the capture
   code.

The slice writes nothing to localStorage; the ring buffer is in-memory only.
This avoids the cross-tab consistency concern (`implement-cross-tab-fa8cb14c`
covers the SaveGame; the error log is not persisted).

## Affected Files

- `src/app/errorCapture.ts` (new):
  - `type CapturedError = { id: string; message: string; stackPrefix: string; timestamp: number; buildId: string; userAgent: string; }`.
  - `installErrorCapture(options?): { uninstall: () => void; getRecent: () => readonly CapturedError[]; clear: () => void; }`. Subscribes to
    `window.addEventListener("error", ...)` and `addEventListener("unhandledrejection", ...)`. Dedup by `stackPrefix` (top-3
    stack frames after symbolication) so a render-loop crash does not flood
    the buffer.
  - Ring buffer cap of 32 entries; oldest evicted.
  - Optional `sink?: ErrorSink` in options; if provided, the sink's
    `report(error)` is called per de-duplicated capture. Default is no sink.
  - `type ErrorSink = { report: (error: CapturedError) => Promise<void> | void; }`.
  - `BUILD_ID` and `BUILD_VERSION` are read from
    `src/app/buildInfo.ts` (created by
    `implement-build-ver-c26ddc1f`).
- `src/app/devErrorPanel.tsx` (new): renders the recent errors as a fixed
  bottom-right overlay when `?errors=1` is in the URL. Includes a "copy all"
  button. Hidden by default (no DOM render). Server-rendered as null on
  first paint to avoid hydration mismatch.
- `src/app/layout.tsx` (modify): call `installErrorCapture()` once in a
  client-only effect. Mount `<DevErrorPanel />`.
- `src/app/__tests__/errorCapture.test.ts` (new): captures dispatch via
  `window.dispatchEvent(new ErrorEvent("error", {...}))`; asserts
  deduplication; asserts ring-buffer cap; asserts no fetch / XHR is invoked
  when no sink is configured (mock fetch and assert zero calls); asserts
  the sink is called with the deduplicated payload when configured.
- `docs/gdd/27-risks-and-mitigations.md` (modify): append a "User-reported
  errors" row noting the opt-in capture and the lack of default telemetry.
- `docs/OPEN_QUESTIONS.md` (modify): add `Q-NNN: should the v0.1 release
  ship with a self-hosted error sink, and if so where?` with recommended
  default "no sink in v0.1; revisit at v0.2 once usage data exists".

## Edge Cases

- SSR: `window` is undefined; the install function no-ops on the server and
  returns a stub uninstall. Test exercises the SSR branch.
- Browsers that fire `error` events with no `error` object (cross-origin
  scripts): the capture stores the message and a synthetic stack prefix
  (`<no-stack>`) so a copy-paste still gives the dev the URL and line number.
- React error boundary integration: the boundary in
  `implement-pause-overlay-265e9b56` calls `installErrorCapture().getRecent()`
  to render the offending error inline. Document the contract here so the
  pause-overlay slice consumes it correctly.
- A future Sentry adapter must NOT be added in this slice (per
  WORKING_AGREEMENT §11). When the dev approves a sink in the OPEN_QUESTIONS
  resolution, a follow-up slice adds the adapter.
- The capture must NOT include any PII. Test asserts that `userAgent` is the
  only browser-supplied string and the message / stack are passed through
  unchanged. No cookies, no localStorage values, no save state.
- "Copy all" is plain text JSON; the format is documented in the dev panel
  file header so a user issue paste is structured.

## Verify

- [ ] Capture installs without throwing on SSR (jsdom test sets
      `window = undefined` and asserts the no-op).
- [ ] `installErrorCapture()` with no sink: dispatching 5 distinct errors
      produces 5 entries; dispatching the same error 100 times produces 1
      entry with a count.
- [ ] Mocked global `fetch`: no calls when no sink is configured. The
      negative assertion is the slice's most important guarantee.
- [ ] Configured sink receives the deduplicated payload and is awaited
      (returned promise rejection does not break the capture; logged via
      `console.warn`).
- [ ] Build embeds `BUILD_ID` and `BUILD_VERSION` from
      `src/app/buildInfo.ts`; CapturedError carries both.
- [ ] `?errors=1` panel renders only on the client; SSR HTML does not
      include it.
- [ ] OPEN_QUESTIONS.md has the `Q-NNN` entry on sink choice.
- [ ] No em-dashes or en-dashes in added files.
- [ ] PROGRESS_LOG.md entry added per §6.

## References

- `docs/WORKING_AGREEMENT.md` §11 (irreversible actions: telemetry).
- `docs/gdd/27-risks-and-mitigations.md`.
- `.dots/VibeGear2-implement-pause-overlay-265e9b56.md` (consumes
  `getRecent()` from the global error boundary).
- `.dots/VibeGear2-implement-build-ver-c26ddc1f.md` (provides BUILD_ID,
  BUILD_VERSION).
- `.dots/VibeGear2-implement-cross-browser-7cf643ce.md` (uses `?errors=1`
  panel during the cross-browser pass).
