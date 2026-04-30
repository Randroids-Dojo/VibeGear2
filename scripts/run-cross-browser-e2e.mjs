import { spawnSync } from "node:child_process";

const result = spawnSync(
  "playwright",
  [
    "test",
    "--project=cross-browser-chromium",
    "--project=cross-browser-firefox",
    "--project=cross-browser-webkit",
  ],
  {
    env: { ...process.env, PLAYWRIGHT_CROSS_BROWSER: "1" },
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
