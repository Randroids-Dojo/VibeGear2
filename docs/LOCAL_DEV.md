# Local Development Troubleshooting

Use this when a fresh clone or local run refuses to behave. Commands assume
you are in the repository root.

## Required Node Version

Use Node 20 or newer. The project declares this in `package.json` under
`engines.node`.

```sh
node --version
```

If your shell uses `nvm`, run:

```sh
nvm install 20
nvm use 20
```

## First-Time Clone

Use the lockfile for reproducible installs:

```sh
npm ci
npx playwright install chromium
npm run dev
```

Use `npm install` only when intentionally changing dependencies.

## Port 3000 Busy

Next.js dev may fall back to port 3001, but production `next start` expects
port 3000 unless told otherwise.

macOS or Linux:

```sh
lsof -i :3000
kill <pid>
```

Windows PowerShell:

```powershell
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

## macOS npm Cache Corruption

If installs fail with cache or tarball errors, clear local install state and
retry:

```sh
rm -rf node_modules ~/.npm/_cacache
npm ci
```

## Vitest or jsdom Install Warning

Vitest may mention optional peers during install. Treat warnings as noise if
`npm run test` passes. If tests fail because `jsdom` is missing, rerun:

```sh
npm ci
```

## Playwright Browsers Missing

If e2e tests fail before launching Chromium, install the browser:

```sh
npx playwright install chromium
```

On Linux CI-like hosts, use:

```sh
npx playwright install --with-deps chromium
```

## Build Succeeds But The Title Screen Is Blank

Check the browser console first. If `/api/version` or build-id reads as
`undefined`, rebuild inside a git checkout or provide the same git SHA env
fallback used by CI. Then run:

```sh
npm run build
npm run start
```

## No-Dash Grep Finds Generated Files

The no-dash rule applies to repo source and authored docs. Do not scan
`node_modules`, `.next`, Playwright reports, or other generated output.
For source files, use the targeted command from `AGENTS.md`.
