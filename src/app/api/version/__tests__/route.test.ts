/**
 * Vitest suite for `GET /api/version`.
 *
 * The route is the smallest of all our handlers: it reads `BUILD_ID`
 * (compiled to "dev" under Vitest because `generateBuildId` does not
 * run) and returns it inside `{ version }`. We pin the response shape
 * so a future caller (the `UpdateBanner` polling client) keeps a
 * stable contract.
 */

import { describe, expect, it } from "vitest";

import { BUILD_ID } from "@/app/buildInfo";

import { GET } from "../route";

describe("GET /api/version", () => {
  it("returns 200 with { version: BUILD_ID }", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: string };
    expect(body).toEqual({ version: BUILD_ID });
  });

  it("response Content-Type is application/json", () => {
    const res = GET();
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("application/json");
  });

  it("body version is a non-empty string", async () => {
    const res = GET();
    const body = (await res.json()) as { version: string };
    expect(typeof body.version).toBe("string");
    expect(body.version.length).toBeGreaterThan(0);
  });
});
