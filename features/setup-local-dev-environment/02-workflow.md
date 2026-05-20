# Workflow — setup-local-dev-environment

## First-time setup (founder runs once)

1. Ensure Docker Desktop is running (same prerequisite as `pnpm qa:db`).
2. `pnpm db:dev:up` — start the dev Postgres container
   (`inflx-dev-pg`, image `postgres:16-alpine`, port `5433`, volume
   `inflx-dev-pgdata`). Idempotent: if already running, no-op.
3. `pnpm db:dev:init` — apply migrations 001–055 against the dev DB,
   then run a smoke probe to confirm core tables/views exist.
4. Copy `backend/.env.local.example` → `backend/.env`
   (this REPLACES the current prod-pointing `backend/.env`; save the
   prod credentials separately if needed for the manual prod-migrate
   step). The new `backend/.env` points at `localhost:5433/inflx_dev`
   and sets all `_MOCK=true` so no real Razorpay/OTP/etc traffic.
5. Copy `Packages/brand-web/.env.local.example` →
   `Packages/brand-web/.env.local`. Same for `admin-web`. Both files
   set `NEXT_PUBLIC_API_URL=http://localhost:3001/v1` (explicit, even
   though the API client falls back to localhost when unset).
6. `pnpm dev:doctor` — confirms everything is wired correctly and
   prints the four URLs.

## Daily start (every working session)

1. `pnpm db:dev:up` (idempotent — fast no-op if container is up).
2. `pnpm dev:all` — concurrently starts backend (`:3001`),
   brand-web (`:3002`), admin-web (`:3003`).
3. (Optional) `pnpm dev:doctor` to confirm health.

## Reset (when dev DB state gets noisy / a destructive schema test
runs / a clean baseline is wanted)

1. `pnpm db:dev:reset` — destroys container + volume, recreates,
   then auto-runs `db:dev:init` (migrations).

## Failure paths (the doctor script must flag, not hide)

- Docker daemon not running → fail loudly with the install/start
  instruction.
- `inflx-dev-pg` container not running → tell the founder to
  `pnpm db:dev:up`.
- Port 5433 in use by a non-`inflx-dev-pg` process → fail with the
  conflicting PID/process suggestion.
- `backend/.env` `DATABASE_URL` does NOT contain `localhost:5433` →
  loud warning ("your backend is configured for a non-local DB —
  this is the prod-as-staging hazard; copy `.env.local.example`").
- Migration count mismatch (dev DB has fewer than the 54 migrations
  applied) → fail with `pnpm db:dev:init` suggestion.
- `Packages/brand-web/.env.local` exists and points at a non-
  localhost URL → loud warning.
- Backend not responding on :3001 → "ensure `pnpm dev:backend` is
  running" (informational, not fatal — doctor only checks DB+config
  state, not running services, so the founder can run doctor without
  having dev:all up).
