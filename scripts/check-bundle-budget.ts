import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

type Manifest = {
  pages: Record<string, string[]>;
};

type RouteBudget = {
  route: string;
  maxGzipKb: number;
};

const BUILD_DIR = ".next";
const STATIC_PREFIX = "static/";
const ROUTE_BUDGETS: RouteBudget[] = [
  { route: "/page", maxGzipKb: 260 },
  { route: "/race/page", maxGzipKb: 310 },
  { route: "/world/page", maxGzipKb: 290 },
  { route: "/garage/page", maxGzipKb: 290 },
  { route: "/options/page", maxGzipKb: 290 },
];
const TOTAL_STATIC_BUDGET_GZIP_KB = 760;
const gzipSizeCache = new Map<string, number>();

function readManifest(): Manifest {
  const raw = readFileSync(join(BUILD_DIR, "app-build-manifest.json"), "utf8");
  return JSON.parse(raw) as Manifest;
}

function gzipKb(path: string): number {
  const cachedSize = gzipSizeCache.get(path);
  if (cachedSize !== undefined) {
    return cachedSize;
  }

  const source = readFileSync(join(BUILD_DIR, path));
  const size = gzipSync(source).byteLength / 1024;
  gzipSizeCache.set(path, size);
  return size;
}

function isBudgetedAsset(path: string): boolean {
  return (
    path.startsWith(STATIC_PREFIX) &&
    (path.endsWith(".js") || path.endsWith(".css"))
  );
}

function uniqueAssets(manifest: Manifest): string[] {
  return [
    ...new Set(
      Object.values(manifest.pages)
        .flat()
        .filter(isBudgetedAsset),
    ),
  ].sort();
}

function routeAssets(manifest: Manifest, route: string): string[] {
  const assets = manifest.pages[route];
  if (!assets) {
    throw new Error(`Missing route ${route} in app-build-manifest.json`);
  }
  return assets.filter(isBudgetedAsset);
}

function sumGzipKb(paths: string[]): number {
  return paths.reduce((total, path) => total + gzipKb(path), 0);
}

function assertBuildExists(): void {
  statSync(join(BUILD_DIR, "app-build-manifest.json"));
}

function formatKb(value: number): string {
  return `${value.toFixed(1)} KiB`;
}

assertBuildExists();

const manifest = readManifest();
let failed = false;

for (const budget of ROUTE_BUDGETS) {
  const size = sumGzipKb(routeAssets(manifest, budget.route));
  const passed = size <= budget.maxGzipKb;
  console.log(
    `${passed ? "pass" : "fail"} ${budget.route} ${formatKb(size)} <= ${formatKb(
      budget.maxGzipKb,
    )}`,
  );
  failed ||= !passed;
}

const totalStaticGzipKb = sumGzipKb(uniqueAssets(manifest));
const totalPassed = totalStaticGzipKb <= TOTAL_STATIC_BUDGET_GZIP_KB;
console.log(
  `${totalPassed ? "pass" : "fail"} total static ${formatKb(
    totalStaticGzipKb,
  )} <= ${formatKb(TOTAL_STATIC_BUDGET_GZIP_KB)}`,
);
failed ||= !totalPassed;

if (failed) {
  process.exitCode = 1;
}
