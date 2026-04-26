"use client";

/**
 * Dev-only test fixture for the app shell error boundary.
 *
 * Visit `/dev/throw` to force a synchronous render error inside the
 * `<ErrorBoundary>` that wraps the root layout. The boundary catches
 * the throw and renders the fallback UI (Reload button, Copy error
 * button, and the inline error message). Exercised by
 * `e2e/error-boundary.spec.ts`.
 *
 * This route is intentionally a client component so the throw happens
 * during the React render phase the boundary can intercept. A server
 * component throw would surface as a server error and never reach the
 * client-side fallback.
 *
 * The route is excluded from the title-screen menu and from the public
 * sitemap. It only exists so the e2e harness has a deterministic way
 * to exercise the fallback without polluting any production code path
 * with `?test_error=1` style query-string side channels.
 */

import { useEffect, useState, type ReactElement } from "react";

const FORCED_ERROR_MESSAGE = "Forced render throw from /dev/throw";

/**
 * The throw is gated behind a mount effect so the static-generation
 * pass during `next build` does not see it (a server-side throw would
 * fail prerender; the boundary is client only). On first client paint
 * the effect flips `armed` to true and the next render throws inside
 * the React render phase, where the boundary intercepts.
 */
export default function ThrowDevPage(): ReactElement {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(true);
  }, []);
  if (armed) {
    throw new Error(FORCED_ERROR_MESSAGE);
  }
  return <main data-testid="throw-dev-arming">Arming...</main>;
}
