import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Read the package version from package.json at config-load time. Reading
 * the file directly (rather than `import pkg from "./package.json" assert`)
 * keeps the config compatible with older Node module-resolver behaviour and
 * avoids dragging the JSON into the client bundle. The value is exposed via
 * `env.NEXT_PUBLIC_BUILD_VERSION` so the client bundle sees a baked-in
 * string.
 */
function readPackageVersion() {
  try {
    const raw = readFileSync(path.join(__dirname, "package.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // fall through to the dev fallback
  }
  return "0.0.0-dev";
}

/**
 * Resolve the short git SHA for the current HEAD. Falls back to the
 * `GIT_SHA` env var (which CI providers like Vercel and GitHub Actions can
 * inject when the build runs outside a `.git` checkout) and finally to the
 * literal string `"dev"` so the local `next dev` server has a stable
 * sentinel value. Per GDD section 21 this is the asset-pipeline checksum
 * version.
 */
function resolveBuildId() {
  try {
    const sha = execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (sha.length > 0) {
      return sha;
    }
  } catch {
    // git not available, e.g. inside a tarball install
  }
  const envSha = process.env.GIT_SHA;
  if (typeof envSha === "string" && envSha.length > 0) {
    return envSha;
  }
  return "dev";
}

const BUILD_ID = resolveBuildId();
const BUILD_VERSION = readPackageVersion();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  typedRoutes: true,
  // Production source maps let the opt-in error reporter (see
  // VibeGear2-implement-opt-in-b65cbbb8) map minified stack frames back to
  // source. Vercel and most static hosts only serve `.map` files when
  // explicitly requested, so the maps stay a build-only artefact for the
  // future error-reporting upload step rather than ride along with every
  // page load.
  productionBrowserSourceMaps: true,
  // Pin the Next.js build id to the git SHA so the page output and the
  // generated chunk filenames both encode the source revision. Async return
  // matches the documented contract.
  generateBuildId: async () => BUILD_ID,
  // Bake the build identifiers into the client bundle as compile-time
  // constants so `process.env.NEXT_PUBLIC_BUILD_ID` and
  // `process.env.NEXT_PUBLIC_BUILD_VERSION` resolve at runtime in both the
  // browser and the server, and so tree-shaking turns them into string
  // literals.
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
};

export default nextConfig;
