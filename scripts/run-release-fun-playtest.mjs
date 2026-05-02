import { spawn } from "node:child_process";

const child = spawn(
  "npx",
  [
    "playwright",
    "test",
    "e2e/release-fun-playtest.spec.ts",
    "--project=chromium",
    "--workers=1",
  ],
  {
    env: { ...process.env, RELEASE_FUN_PLAYTEST: "1" },
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
