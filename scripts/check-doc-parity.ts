import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assertIncludes(filePath: string, content: string, needle: string): void {
  const normalizedContent = content.replace(/\s+/g, " ");
  const normalizedNeedle = needle.replace(/\s+/g, " ");
  if (!normalizedContent.includes(normalizedNeedle)) {
    fail(`${filePath} is missing required docs anchor: ${needle}`);
  }
}

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
const scripts = Object.keys(packageJson.scripts ?? {}).sort();
const scriptsDoc = read("docs/SCRIPTS.md");

for (const script of scripts) {
  assertIncludes("docs/SCRIPTS.md", scriptsDoc, `| \`${script}\` |`);
}

const agents = read("AGENTS.md");
const contributing = read("docs/CONTRIBUTING.md");

const sharedAnchors = [
  "Create short-lived branches from `main` named `feat/<slice>`, `fix/<slice>`, `chore/<slice>`, or `docs/<slice>`.",
  "<type>(<area>): <imperative summary>",
  "Do not bypass checks with `--no-verify`.",
  "Do not use em-dashes or en-dashes anywhere.",
];

for (const anchor of sharedAnchors) {
  assertIncludes("AGENTS.md", agents, anchor);
  assertIncludes("docs/CONTRIBUTING.md", contributing, anchor);
}

console.log(`docs:check: ${scripts.length} scripts and ${sharedAnchors.length} shared anchors verified`);
