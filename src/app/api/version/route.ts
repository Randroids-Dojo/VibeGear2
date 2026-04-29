/**
 * `GET /api/version` handler.
 *
 * Returns the build's git short SHA so a long-lived client tab can
 * detect that the server it is talking to has been redeployed and the
 * locally cached bundle is stale. The response is a tiny stable JSON
 * envelope so a future field addition does not break old clients.
 *
 * Why this works as a deploy-detector: `next.config.mjs` resolves the
 * git SHA at build time and inlines it into both the client bundle and
 * the server's compiled output via `env.NEXT_PUBLIC_BUILD_ID`. A
 * freshly deployed server therefore reports the new SHA while the
 * still-loaded old client bundle remembers the SHA it was built with.
 * `UpdateBanner` polls this endpoint and compares the two strings.
 *
 * `dynamic = "force-dynamic"` opts the route out of the App Router's
 * static optimisation so a CDN cache cannot serve a stale SHA. The
 * route is not on a hot path (one fetch per minute per open tab) so
 * the dynamic cost is negligible. `runtime = "nodejs"` keeps the env
 * lookup behaviour identical to the leaderboard routes and to the
 * Vitest environment.
 */

import { NextResponse } from "next/server";

import { BUILD_ID } from "@/app/buildInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return NextResponse.json({ version: BUILD_ID });
}
