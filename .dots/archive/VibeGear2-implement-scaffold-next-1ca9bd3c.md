---
title: "implement: scaffold Next.js + TypeScript app shell"
status: closed
priority: 1
issue-type: task
created-at: "\"2026-04-26T00:56:06.165569-05:00\""
closed-at: "2026-04-26T01:02:53.410637-05:00"
close-reason: Scaffolded Next.js 15 + React 18 + TS 5 strict + Vitest 2 with §21 module layout (src/game, src/road, src/render). lint, typecheck, unit tests, and next build all green. Title screen renders. Playwright + CI deferred to their own slices.
blocks:
  - VibeGear2-research-confirm-q-1b2df2ab
---

## Description

Stand up the Next.js + TypeScript project skeleton (F-002 part 1). Boot to a placeholder title screen page at `/`. No game logic yet, no renderer, no AI. Just the app shell, build configuration, and a route that proves the framework is wired.

## Context

Phase 0 from `docs/IMPLEMENTATION_PLAN.md` requires a working project skeleton before any gameplay slice can land. `docs/gdd/21-technical-design-for-web-implementation.md` calls for Next.js, React, TypeScript, and the module layout under `src/game/`, `src/road/`, `src/render/`. Q-001 in `docs/OPEN_QUESTIONS.md` confirms the stack.

Linked followup: F-002 (open) in `docs/FOLLOWUPS.md`.

## Affected Files

- `package.json` (new)
- `tsconfig.json` (new, strict mode)
- `next.config.js` (new)
- `.gitignore` (new or update)
- `src/app/layout.tsx` (new)
- `src/app/page.tsx` (new, renders title text "VibeGear2")
- `src/game/`, `src/road/`, `src/render/` (placeholder `.gitkeep` files)
- `README.md` (update with run instructions)

## Verify

- [ ] `npm install` succeeds.
- [ ] `npm run build` succeeds with no TypeScript errors.
- [ ] `npm run dev` boots, page at `http://localhost:3000` shows "VibeGear2" text.
- [ ] No em-dashes anywhere (run `grep -rn $'—' .` and confirm zero hits in new files).
- [ ] PROGRESS_LOG.md entry added per §6.
