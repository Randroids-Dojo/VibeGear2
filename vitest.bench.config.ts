import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Standalone Vitest config for the manual render perf bench.
 *
 * The bench lives at `scripts/bench-render.ts` and is invoked via
 * `npm run bench:render`. We use Vitest as the runner so the `@/`
 * path aliases resolve and TypeScript is transpiled without an
 * additional loader dep, but we keep it OUT of the default
 * `vitest.config.ts` include glob so `npm test` and CI never pick it
 * up. Per `AGENTS.md` "CI must be deterministic", perf bench output
 * is informational; it must not gate any pipeline.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/bench-render.ts"],
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
