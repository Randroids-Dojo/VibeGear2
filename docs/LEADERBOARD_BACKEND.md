# Leaderboard Backend

The online leaderboard uses an optional Redis backend. Local development and
static mirrors still work with the default noop backend, but the Vercel
production project is configured to use Upstash Redis through the Vercel
Marketplace.

## Production Resource

- Provider: Upstash Redis through Vercel Marketplace.
- Vercel resource name: `vibegear2-leaderboard`.
- Primary region: `iad1`.
- Billing plan: `paid` Pay As You Go.
- Provisioning flags: `prodPack=false`, `autoUpgrade=false`, `eviction=false`.
- Vercel project: `randroid88s-projects/vibe-gear2`.

## Required Env Vars

The Marketplace integration injects these Redis vars:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
- `KV_URL`
- `REDIS_URL`

The app-owned leaderboard flags are:

- `LEADERBOARD_BACKEND=upstash-redis`
- `NEXT_PUBLIC_LEADERBOARD_ENABLED=true`
- `LEADERBOARD_SIGNING_KEY=<random secret>`

Production has all three app-owned vars set. Development has the same backend
flag and client flag plus a non-sensitive local signing key. The
`feat/upstash-leaderboard-production` preview branch also has branch-scoped
copies of all three app-owned vars so the PR preview exercises the Redis path.

## Runtime Path

`src/leaderboard/store.ts` resolves `LEADERBOARD_BACKEND=upstash-redis` to
`src/leaderboard/store-upstash-redis.ts`. The Upstash store validates
`KV_REST_API_URL` and `KV_REST_API_TOKEN`, constructs `Redis.fromEnv()`, and
reuses the existing Redis command contract in `store-vercel-kv.ts`.

The legacy `vercel-kv` backend tag remains available for compatibility, but new
Vercel projects should use `upstash-redis`.
