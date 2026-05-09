---
title: "implement: F-031 scrub workspace paths from Next.js framework source maps per §21"
status: closed
priority: 3
issue-type: task
created-at: "\"2026-04-26T13:02:35.047826-05:00\""
closed-at: "2026-04-26T13:43:08.176307-05:00"
close-reason: verified
---

blocks: opt-in error reporter slice (parent of this concern). The feat/build-version-stamping slice enabled productionBrowserSourceMaps: true in next.config.mjs so the future opt-in error reporter can map minified frames back to source.

Issue: the verify step grep -E '/Users/|/home/' .next/static/chunks/*.js.map flags two framework maps (main-app-*.js.map, main-*.js.map) whose sources reference /Users/<dev>/.../node_modules/next/dist/... paths. These leaks are inside Next.js framework code, not our own source. Privacy impact: minimal; paths only reveal that the build ran from a workspace whose absolute prefix matches the dev's filesystem layout. Our own chunks (where stack traces would point in any real bug) carry the expected webpack:// prefixes.

Resolution path: revisit when the opt-in error reporter slice lands and decide whether to scrub the absolute prefix during the source-map upload step rather than at build time. Workaround: the deploy host (Vercel / Cloudflare Pages) only serves .map files on explicit request, so the maps stay a build-only artefact in normal browsing.

Possible fixes:
(a) post-build script that rewrites sources entries in .next/static/chunks/*.js.map replacing absolute paths with a stable prefix (best for upload-step parity).
(b) webpack devtoolModuleFilenameTemplate override in next.config.mjs (cleaner if Next.js exposes the hook for framework chunks).
(c) defer until error reporter lands and handle in upload pipeline.

Affected files (when implemented):
- next.config.mjs or scripts/scrub-source-maps.ts (new): the chosen fix path.
- package.json: wire scrub into the build pipeline if (a).
- docs/FOLLOWUPS.md: F-031 marked done.

Priority 3 (nice-to-have) until error reporter slice lands or a privacy review demands it sooner.
