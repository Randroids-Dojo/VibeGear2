import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";

type LighthouseResult = {
  lhr: {
    categories: {
      performance: { score: number | null };
      accessibility: { score: number | null };
      "best-practices": { score: number | null };
    };
  };
};

const PORT = Number(process.env.LIGHTHOUSE_PORT ?? 3200);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROUTES = ["/", "/race?mode=practice", "/garage", "/options"];
const MIN_PERFORMANCE = 0.7;
const MIN_ACCESSIBILITY = 0.9;
const MIN_BEST_PRACTICES = 0.9;
const CHROME_START_TIMEOUT_MS = 30_000;
const LIGHTHOUSE_ROUTE_TIMEOUT_MS = 45_000;
const NPM_COMMAND = process.platform === "win32" ? "npm.cmd" : "npm";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertProductionBuildExists(): void {
  statSync(join(".next", "BUILD_ID"));
  statSync(join(".next", "app-build-manifest.json"));
}

async function waitForServer(serverStopped: Promise<never>): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until next start finishes booting.
    }
    await Promise.race([wait(1000), serverStopped]);
  }
  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

async function withTimeout<T>(
  label: string,
  timeoutMs: number,
  task: Promise<T>,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs} ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function stopServer(server: ReturnType<typeof spawn>): void {
  if (server.pid && process.platform !== "win32") {
    try {
      process.kill(-server.pid);
      return;
    } catch {
      // Fall back to killing the npm wrapper if the process group is gone.
    }
  }
  server.kill();
}

assertProductionBuildExists();

const server = spawn(
  NPM_COMMAND,
  ["run", "start", "--", "--port", String(PORT), "--hostname", "127.0.0.1"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  },
);

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

let chrome: Awaited<ReturnType<typeof launch>> | undefined;
let failed = false;
let stoppingServer = false;

const serverStopped = new Promise<never>((_resolve, reject) => {
  server.once("error", (error) => {
    reject(error);
  });
  server.once("exit", (code, signal) => {
    if (stoppingServer) {
      return;
    }
    reject(
      new Error(
        `next start exited before Lighthouse completed with code ${
          code ?? "null"
        } and signal ${signal ?? "null"}`,
      ),
    );
  });
});

try {
  await waitForServer(serverStopped);
  chrome = await withTimeout(
    "Chrome launch",
    CHROME_START_TIMEOUT_MS,
    Promise.race([
      launch({
        chromePath: chromium.executablePath(),
        chromeFlags: [
          "--headless=new",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
        ],
      }),
      serverStopped,
    ]),
  );

  for (const route of ROUTES) {
    const result = (await withTimeout(
      `Lighthouse ${route}`,
      LIGHTHOUSE_ROUTE_TIMEOUT_MS,
      Promise.race([
        lighthouse(`${BASE_URL}${route}`, {
          port: chrome.port,
          output: "json",
          logLevel: "error",
          onlyCategories: ["performance", "accessibility", "best-practices"],
        }),
        serverStopped,
      ]),
    )) as LighthouseResult | undefined;

    if (!result) {
      throw new Error(`Lighthouse did not return a result for ${route}`);
    }

    const performance = result.lhr.categories.performance.score ?? 0;
    const accessibility = result.lhr.categories.accessibility.score ?? 0;
    const bestPractices = result.lhr.categories["best-practices"].score ?? 0;
    const routePassed =
      performance >= MIN_PERFORMANCE &&
      accessibility >= MIN_ACCESSIBILITY &&
      bestPractices >= MIN_BEST_PRACTICES;

    console.log(
      `${routePassed ? "pass" : "fail"} ${route} performance=${performance.toFixed(
        2,
      )} accessibility=${accessibility.toFixed(2)} best-practices=${bestPractices.toFixed(
        2,
      )}`,
    );

    failed ||= !routePassed;
  }
} finally {
  await chrome?.kill();
  stoppingServer = true;
  stopServer(server);
}

process.exit(failed ? 1 : 0);
