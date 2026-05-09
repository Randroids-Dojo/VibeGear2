---
title: Migrate src/persistence/ to @randroids-dojo/vibekit/storage
status: open
priority: 3
issue-type: task
created-at: "2026-05-08T23:29:09.663220-05:00"
---

VibeGear2 has src/persistence/. Audit and route through ../VibeKit/src/storage.ts where the patterns match (readStorage<T>(key, zodSchema), writeStorage, listenStorage). The kit handles SSR / JSON / schema / quota / cross+same-tab; the project only owns the per-feature schema and key naming.
