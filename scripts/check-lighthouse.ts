import { spawn } from "node:child_process";
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until next start finishes booting.
    }
    await wait(1000);
  }
  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

const server = spawn(
  "npm",
  ["run", "start", "--", "--port", String(PORT), "--hostname", "127.0.0.1"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  },
);

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

let chrome: Awaited<ReturnType<typeof launch>> | undefined;
let failed = false;

try {
  await waitForServer();
  chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });

  for (const route of ROUTES) {
    const result = (await lighthouse(`${BASE_URL}${route}`, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices"],
    })) as LighthouseResult | undefined;

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
  server.kill();
}

if (failed) {
  process.exitCode = 1;
}
