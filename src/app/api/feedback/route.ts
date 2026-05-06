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
 *   - 422 `{ ok: false, code: "invalid-json" }` on a body that is
 *     not parseable JSON.
 *   - 500 `{ ok: false, code: "server-misconfigured" }` when the
 *     `GITHUB_PAT` env var is missing. The 500 path never echoes the
 *     env var name to the client.
 *   - 502 `{ ok: false, code: "github-api-error", status }` on a
 *     non-2xx response from the GitHub API.
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

  const res = await fetch(
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

  if (!res.ok) return null;
  const data = (await res.json()) as { content?: { download_url?: string } };
  return data.content?.download_url ?? null;
}

function buildIssueBody(
  userMessage: string,
  context: FeedbackContext | undefined,
  screenshotUrl: string | null,
): string {
  const parts: string[] = [userMessage];
  if (!context) return userMessage;

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

  let result = parts.join("\n\n");
  if (result.length > GITHUB_BODY_LIMIT) {
    const screenshotIdx = parts.findIndex((p) => p.startsWith("<details>\n<summary>Screenshot (base64"));
    if (screenshotIdx !== -1) {
      parts.splice(screenshotIdx, 1);
      parts.push("> _Screenshot omitted: body size exceeded GitHub limit._");
      result = parts.join("\n\n");
    }
  }
  return result;
}

async function createIssue(
  token: string,
  repo: string,
  title: string,
  body: string,
): Promise<{ ok: true; number: number; url: string } | { ok: false; status: number }> {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels: ["feedback"] }),
  });

  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  const data = (await res.json()) as { number: number; html_url: string };
  return { ok: true, number: data.number, url: data.html_url };
}

export async function POST(request: Request): Promise<Response> {
  const token = process.env.GITHUB_PAT?.trim() ?? "";
  if (token.length === 0) {
    return json(500, { ok: false, code: "server-misconfigured" });
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
