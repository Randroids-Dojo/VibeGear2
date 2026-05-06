/**
 * Vitest suite for the `POST /api/feedback` route.
 *
 * Stubs `globalThis.fetch` so the suite never hits real GitHub. Each
 * case asserts the (status, code) pair from the route's stable
 * envelope. The handler reads `process.env.GITHUB_PAT` and
 * `process.env.FEEDBACK_REPO`; we set / restore them per-test so the
 * suite is order-independent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

const TOKEN = "ghp_test_token";
const REPO = "Randroids-Dojo/VibeGear2-Test";

let savedToken: string | undefined;
let savedRepo: string | undefined;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  savedToken = process.env.GITHUB_PAT;
  savedRepo = process.env.FEEDBACK_REPO;
  process.env.GITHUB_PAT = TOKEN;
  process.env.FEEDBACK_REPO = REPO;
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  if (savedToken === undefined) delete process.env.GITHUB_PAT;
  else process.env.GITHUB_PAT = savedToken;
  if (savedRepo === undefined) delete process.env.FEEDBACK_REPO;
  else process.env.FEEDBACK_REPO = savedRepo;
  globalThis.fetch = originalFetch;
});

function makeRequest(body: unknown): Request {
  return new Request("http://test.local/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
  it("returns 500 when GITHUB_PAT is unset", async () => {
    delete process.env.GITHUB_PAT;
    const res = await POST(makeRequest({ title: "t", body: "b" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { ok: false; code: string };
    expect(json).toEqual({ ok: false, code: "server-misconfigured" });
  });

  it("returns 422 on non-JSON body", async () => {
    const res = await POST(makeRequest("not-json{"));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { ok: false; code: string };
    expect(json.code).toBe("invalid-json");
  });

  it("returns 400 when title or body is missing", async () => {
    const res = await POST(makeRequest({ title: "  ", body: "b" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: false; code: string };
    expect(json.code).toBe("missing-fields");
  });

  it("creates an issue on the configured repo with the feedback label", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init: init ?? {} });
      return new Response(
        JSON.stringify({ number: 42, html_url: `https://github.com/${REPO}/issues/42` }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    const res = await POST(
      makeRequest({
        title: "Player feedback",
        body: "Track ramp warps at the crest",
        context: {
          urlPath: "/quick-race",
          userAgent: "TestAgent/1.0",
          viewport: "1280x800",
          timestamp: "2026-05-05T12:00:00.000Z",
        },
      }),
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      ok: true;
      code: string;
      number: number;
      url: string;
    };
    expect(json).toEqual({
      ok: true,
      code: "created",
      number: 42,
      url: `https://github.com/${REPO}/issues/42`,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`https://api.github.com/repos/${REPO}/issues`);
    const sentBody = JSON.parse((calls[0]?.init.body ?? "{}") as string) as {
      title: string;
      body: string;
      labels: string[];
    };
    expect(sentBody.title).toBe("Player feedback");
    expect(sentBody.labels).toEqual(["feedback"]);
    expect(sentBody.body).toContain("Track ramp warps at the crest");
    expect(sentBody.body).toContain("**URL:** `/quick-race`");
    expect(sentBody.body).toContain("TestAgent/1.0");
  });

  it("uploads the screenshot and embeds the URL in the issue body", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, method: init?.method });
      if (url.includes("/contents/")) {
        return new Response(
          JSON.stringify({
            content: { download_url: "https://raw.example/screenshot.jpg" },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ number: 7, html_url: `https://github.com/${REPO}/issues/7` }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    const res = await POST(
      makeRequest({
        title: "With screenshot",
        body: "Look at this",
        context: {
          screenshot: "data:image/jpeg;base64,AAAA",
        },
      }),
    );
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain(`/repos/${REPO}/contents/.github/feedback-screenshots/`);
    expect(calls[0]?.method).toBe("PUT");
    expect(calls[1]?.url).toBe(`https://api.github.com/repos/${REPO}/issues`);
  });

  it("falls back to inline base64 when the screenshot upload fails", async () => {
    let issueBodyCaptured = "";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/contents/")) {
        return new Response("nope", { status: 403 });
      }
      issueBodyCaptured = (init?.body ?? "") as string;
      return new Response(
        JSON.stringify({ number: 9, html_url: `https://github.com/${REPO}/issues/9` }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    const res = await POST(
      makeRequest({
        title: "Inline fallback",
        body: "Body",
        context: { screenshot: "data:image/jpeg;base64,AAAA" },
      }),
    );
    expect(res.status).toBe(201);
    const sent = JSON.parse(issueBodyCaptured) as { body: string };
    expect(sent.body).toContain("Screenshot (base64");
    expect(sent.body).toContain("data:image/jpeg;base64,AAAA");
  });

  it("returns 502 when the GitHub issue create fails", async () => {
    globalThis.fetch = vi.fn(async () => new Response("boom", { status: 503 })) as typeof globalThis.fetch;
    const res = await POST(
      makeRequest({ title: "t", body: "b" }),
    );
    expect(res.status).toBe(502);
    const json = (await res.json()) as { ok: false; code: string; status?: number };
    expect(json.code).toBe("github-api-error");
    expect(json.status).toBe(503);
  });

  it("renders captured errors as a details block in the issue body", async () => {
    let issueBodyCaptured = "";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      issueBodyCaptured = (init?.body ?? "") as string;
      return new Response(
        JSON.stringify({ number: 1, html_url: `https://github.com/${REPO}/issues/1` }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    await POST(
      makeRequest({
        title: "errors",
        body: "see attached",
        context: {
          capturedErrors: [
            {
              id: "err-abc",
              message: "boom",
              stackPrefix: "at Foo (foo.ts:1:1)",
              timestamp: 1_700_000_000_000,
              count: 2,
              buildId: "abc",
              buildVersion: "0.2.0",
            },
          ],
        },
      }),
    );

    const sent = JSON.parse(issueBodyCaptured) as { body: string };
    expect(sent.body).toContain("Captured errors (1)");
    expect(sent.body).toContain("boom");
    expect(sent.body).toContain("x2");
    expect(sent.body).toContain("at Foo (foo.ts:1:1)");
  });
});
