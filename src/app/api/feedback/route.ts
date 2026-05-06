/**
 * `POST /api/feedback` handler.
 *
 * Forwards a player feedback message to GitHub as a labelled issue,
 * optionally uploading a small canvas screenshot first so the issue
 * body can render an `<img>` instead of a base64 blob. The contract
 * is the simplest sink described in Q-012 option (b): a first-party
 * route owned by this repo, gated by an explicit user click, that
 * never exfiltrates data without that click.
 *
 * Stable response envelope mirrors the leaderboard route style:
 *   - 201 `{ ok: true, code: "created", number, url }` on success.
 *   - 400 `{ ok: false, code: "missing-fields" }` when title or body
 *     is empty.
 *   - 403 `{ ok: false, code: "forbidden-origin" }` when the request
 *     does not carry a same-origin Origin or Referer header.
 *   - 422 `{ ok: false, code: "invalid-json" }` on a body that is
 *     not parseable JSON.
 *   - 429 `{ ok: false, code: "rate-limited" }` when an IP exceeds
 *     the per-window quota.
 *   - 500 `{ ok: false, code: "server-misconfigured" }` when the
 *     `GITHUB_PAT` env var is missing. The 500 path never echoes the
 *     env var name to the client.
 *   - 502 `{ ok: false, code: "github-api-error", status }` on a
 *     non-2xx response from the GitHub API or a network failure
 *     reaching it.
 *
 * Abuse mitigation has two layers: a same-origin check (Origin or
 * Referer header must match the request host) blocks trivial scripted
 * abuse from third-party origins, and an in-memory per-IP sliding
 * window rate limit caps each client to a small number of submissions
 * per window. The rate-limit map resets on cold start (acceptable for
 * "throttle casual abuse"); a determined attacker would need a
 * distributed limiter, tracked as future hardening.
 *
 * The handler hits `https://api.github.com` directly; a future Edge
 * runtime variant would still work because both calls use the global
 * `fetch`. We pin Node so the `process.env` lookup matches dev,
 * Vitest, and the Vercel deploy.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REPO = "Randroids-Dojo/VibeGear2";
const GITHUB_BODY_LIMIT = 65_536;
const MAX_MESSAGE_CHARS = 32_000;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_BUCKET_CAP = 1024;
const ipBuckets = new Map<string, number[]>();

export function __resetRateLimitForTests(): void {
  ipBuckets.clear();
}

function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const previous = ipBuckets.get(ip);
  const recent = previous ? previous.filter((t) => t > cutoff) : [];
  if (recent.length >= RATE_LIMIT_MAX) {
    ipBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  ipBuckets.set(ip, recent);
  if (ipBuckets.size > RATE_LIMIT_BUCKET_CAP) {
    for (const [k, v] of ipBuckets) {
      const r = v.filter((t) => t > cutoff);
      if (r.length === 0) ipBuckets.delete(k);
      else ipBuckets.set(k, r);
    }
  }
  return true;
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const candidate = origin ?? (referer ? safeUrlOrigin(referer) : null);
  if (!candidate) return false;
  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}

function safeUrlOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

interface FeedbackContext {
  readonly urlPath?: string;
  readonly userAgent?: string;
  readonly viewport?: string;
  readonly timestamp?: string;
  readonly screenshot?: string | null;
  readonly capturedErrors?: ReadonlyArray<CapturedErrorPayload> | null;
}

interface CapturedErrorPayload {
  readonly id: string;
  readonly message: string;
  readonly stackPrefix: string;
  readonly timestamp: number;
  readonly count: number;
  readonly buildId: string;
  readonly buildVersion: string;
  readonly userAgent?: string;
}

interface FeedbackBody {
  readonly title?: string;
  readonly body?: string;
  readonly context?: FeedbackContext;
}

type ResponseBody =
  | { ok: true; code: "created"; number: number; url: string }
  | { ok: false; code: string; message?: string; status?: number };

function json(status: number, body: ResponseBody): Response {
  return NextResponse.json(body, { status });
}

function getRepo(): string {
  return process.env.FEEDBACK_REPO?.trim() || DEFAULT_REPO;
}

function formatCapturedErrors(errors: ReadonlyArray<CapturedErrorPayload>): string {
  return errors
    .map((entry) => {
      const time = new Date(entry.timestamp).toISOString().replace(/^.*T/, "").replace(/\.\d+Z$/, "");
      const count = entry.count > 1 ? ` x${entry.count}` : "";
      return `[${time}${count}] ${entry.message}\n${entry.stackPrefix}`;
    })
    .join("\n\n");
}

async function uploadScreenshot(
  token: string,
  repo: string,
  base64DataUrl: string,
): Promise<string | null> {
  const base64Content = base64DataUrl.replace(/^data:image\/\w+;base64,/, "");
  const filename = `feedback-${Date.now()}.jpg`;
  const path = `.github/feedback-screenshots/${filename}`;

  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `chore(feedback): add screenshot ${filename}`,
          content: base64Content,
        }),
      },
    );
  } catch {
    return null;
  }

  if (!res.ok) return null;
  try {
    const data = (await res.json()) as { content?: { download_url?: string } };
    return data.content?.download_url ?? null;
  } catch {
    return null;
  }
}

function buildIssueBody(
  userMessage: string,
  context: FeedbackContext | undefined,
  screenshotUrl: string | null,
): string {
  const trimmedMessage =
    userMessage.length > MAX_MESSAGE_CHARS
      ? `${userMessage.slice(0, MAX_MESSAGE_CHARS)}\n\n_(message truncated by server)_`
      : userMessage;

  const parts: string[] = [trimmedMessage];
  if (!context) return clipToGitHubLimit(parts);

  const meta: string[] = [];
  if (context.urlPath) meta.push(`**URL:** \`${context.urlPath}\``);
  if (context.timestamp) meta.push(`**Submitted:** ${context.timestamp}`);
  if (context.userAgent) meta.push(`**User Agent:** ${context.userAgent}`);
  if (context.viewport) meta.push(`**Viewport:** ${context.viewport}`);

  if (meta.length > 0) {
    parts.push(
      `<details>\n<summary>Context</summary>\n\n${meta.join("\n")}\n\n</details>`,
    );
  }

  if (context.capturedErrors && context.capturedErrors.length > 0) {
    const formatted = formatCapturedErrors(context.capturedErrors);
    parts.push(
      `<details>\n<summary>Captured errors (${context.capturedErrors.length})</summary>\n\n\`\`\`\n${formatted}\n\`\`\`\n\n</details>`,
    );
  }

  if (screenshotUrl) {
    parts.push(
      `<details open>\n<summary>Screenshot</summary>\n\n![Screenshot](${screenshotUrl})\n\n</details>`,
    );
  } else if (context.screenshot) {
    parts.push(
      `<details>\n<summary>Screenshot (base64 JPEG)</summary>\n\nPaste into a browser address bar to view.\n\n\`\`\`\n${context.screenshot}\n\`\`\`\n\n</details>`,
    );
  }

  return clipToGitHubLimit(parts);
}

function clipToGitHubLimit(parts: string[]): string {
  let result = parts.join("\n\n");
  if (result.length <= GITHUB_BODY_LIMIT) return result;

  const inlineScreenshotIdx = parts.findIndex((p) =>
    p.startsWith("<details>\n<summary>Screenshot (base64"),
  );
  if (inlineScreenshotIdx !== -1) {
    parts.splice(inlineScreenshotIdx, 1);
    parts.push("> _Screenshot omitted: body size exceeded GitHub limit._");
    result = parts.join("\n\n");
    if (result.length <= GITHUB_BODY_LIMIT) return result;
  }

  const errorBlockIdx = parts.findIndex((p) =>
    p.startsWith("<details>\n<summary>Captured errors"),
  );
  if (errorBlockIdx !== -1) {
    parts.splice(errorBlockIdx, 1);
    parts.push("> _Captured errors omitted: body size exceeded GitHub limit._");
    result = parts.join("\n\n");
    if (result.length <= GITHUB_BODY_LIMIT) return result;
  }

  const overshoot = result.length - GITHUB_BODY_LIMIT;
  const truncationNote = "\n\n_(message truncated by server)_";
  const message = parts[0] ?? "";
  const room = Math.max(0, message.length - overshoot - truncationNote.length - 64);
  parts[0] = `${message.slice(0, room)}${truncationNote}`;
  return parts.join("\n\n");
}

async function createIssue(
  token: string,
  repo: string,
  title: string,
  body: string,
): Promise<
  | { ok: true; number: number; url: string }
  | { ok: false; status: number }
  | { ok: false; status: 0 }
> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, labels: ["feedback"] }),
    });
  } catch {
    return { ok: false, status: 0 };
  }

  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  try {
    const data = (await res.json()) as { number: number; html_url: string };
    return { ok: true, number: data.number, url: data.html_url };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function POST(request: Request): Promise<Response> {
  const token = process.env.GITHUB_PAT?.trim() ?? "";
  if (token.length === 0) {
    return json(500, { ok: false, code: "server-misconfigured" });
  }

  if (!isSameOrigin(request)) {
    return json(403, { ok: false, code: "forbidden-origin" });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return json(429, { ok: false, code: "rate-limited" });
  }

  const raw = await request.text();
  let parsed: FeedbackBody;
  try {
    parsed = JSON.parse(raw) as FeedbackBody;
  } catch {
    return json(422, { ok: false, code: "invalid-json" });
  }

  const title = parsed.title?.trim() ?? "";
  const body = parsed.body?.trim() ?? "";
  if (title.length === 0 || body.length === 0) {
    return json(400, { ok: false, code: "missing-fields" });
  }

  const repo = getRepo();
  let screenshotUrl: string | null = null;
  if (parsed.context?.screenshot) {
    screenshotUrl = await uploadScreenshot(token, repo, parsed.context.screenshot);
  }

  const enriched = buildIssueBody(body, parsed.context, screenshotUrl);
  const result = await createIssue(token, repo, title, enriched);
  if (!result.ok) {
    return json(502, { ok: false, code: "github-api-error", status: result.status });
  }
  return json(201, { ok: true, code: "created", number: result.number, url: result.url });
}
