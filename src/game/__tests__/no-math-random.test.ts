/**
 * Static guard that bans `Math.random()` calls in `src/game/` (other
 * than the RNG module's tests, which may reference the literal in
 * docstrings). The runtime randomness contract per
 * `VibeGear2-implement-seeded-deterministic-2ae383f2` is that every
 * roll comes from `src/game/rng.ts`; a stray `Math.random()` call
 * silently breaks the §21 deterministic-replay tests.
 *
 * The check strips `// ...` and `/* ... *\/` comments before scanning
 * so docstrings that mention `Math.random` (typically as a "no
 * Math.random" reassurance) do not trip the guard. The literal token
 * `Math.random` in code (i.e. a call site or a function reference)
 * always trips, even when the call is wrapped in a guard or only
 * referenced by name; this is intentional, since reading the value out
 * is the same risk as calling it.
 *
 * Belt-and-braces companion to the ESLint `no-restricted-syntax` rule
 * shipped in `.eslintrc.json`. The lint rule catches the syntactic
 * `MemberExpression`; this test catches lint-bypass paths (an editor
 * with auto-fix disabled, a `// eslint-disable` annotation, or a CI
 * environment that skips lint).
 *
 * The scope is `src/game/` only; the render pipeline's particle code
 * lives under `src/render/effects*` (visual-polish slice) and will get
 * its own guard once that path exists. The nitro / damage / sector
 * test files' docstrings reference `Math.random` for context; those
 * mentions live in `__tests__/` files so the comment-stripper handles
 * them and the guard stays focused on production code.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const GAME_DIR = join(process.cwd(), "src", "game");
const ALLOWED_FILES = new Set<string>([
  // The RNG module is the one place a call site is permitted (and even
  // there it does not actually call `Math.random`; it transcribes the
  // mulberry32 algorithm). The allow-list keeps the guard focused on
  // production-side regressions rather than this module's own docstring.
  "rng.ts",
]);

/**
 * Strip `// line` and `/* block *\/` comments so docstring mentions of
 * the banned token do not trip the guard. Naive but sufficient for
 * `src/game/`, which uses standard TypeScript comment syntax and never
 * embeds `*\/` inside a string literal that the regex would mis-close.
 *
 * The regex order matters: line comments first so a `// ... /* ... *\/`
 * sequence does not accidentally consume the entire rest of the file
 * as a block comment.
 */
function stripComments(source: string): string {
  let out = source;
  // Line comments. Match the start of a `//` to end-of-line.
  out = out.replace(/\/\/.*$/gm, "");
  // Block comments. Non-greedy so a file with multiple block comments
  // does not collapse into a single mega-comment.
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  return out;
}

/**
 * Walk `dir` recursively and return every `.ts` file's relative path.
 * Skips test directories (their content can reference banned tokens
 * inside docstrings, and those docstrings are not load-bearing for
 * runtime determinism).
 */
function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test directories; their content is not in the runtime
      // determinism path.
      if (entry.name === "__tests__") continue;
      out.push(...listSourceFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

describe("no Math.random in src/game", () => {
  it("no production source under src/game references Math.random outside the RNG module", () => {
    const files = listSourceFiles(GAME_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      const basename = file.split("/").pop() ?? file;
      if (ALLOWED_FILES.has(basename)) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      if (code.includes("Math.random")) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
