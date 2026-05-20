# Spec — Setup local-dev environment (Phase 1 of the engineering cycle)

## Problem (verify-twice confirmed)

The intended local-dev setup per `backend/.env.example` is an isolated
local Postgres + mocked external services. In reality, the current
`backend/.env` on the founder's machine points at the **PRODUCTION**
Supabase: `pnpm dev:backend` connects to prod, and the manual
`run-055.js` step earlier this window modified prod data.

There is **no actual local DB** for live dev today. The only isolated
Postgres is `qa:db` (ephemeral Docker container on port 5544, dies
after each jest run — test-only, not a dev environment).

The founder's stated cycle ("we do all development, testing and
confirm in dev, then we push to prod") therefore does not yet hold:
"dev" is currently prod.

## Goal

A real, isolated, persistent local-dev stack on the founder's machine
that delivers, in one `pnpm` command, a working three-side platform
talking to its own DB:

- Backend on `http://localhost:3001`, talking to its **own** Postgres.
- Brand-web on `http://localhost:3002` → local backend.
- Admin-web on `http://localhost:3003` → local backend.
- All external services mocked (OTP `000000`, Razorpay test, Apify
  fixture, FCM/OneSignal/R2 mocked).
- A single `pnpm dev:doctor` command verifies the whole stack and
  prints the URLs.

## Non-goals (explicitly scoped out)

- Staging environment — deferred per founder (~2 days, separate
  contract once the second Render subscription is set up).
- Mobile dev wiring — `Packages/Mobile/src/config/api.js` hardcodes
  `USE_PRODUCTION = true`. Deferred to Phase 2 (Maestro/mobile cycle);
  flagged in `LOCAL.md` as a manual toggle for now.
- Changing any `backend/src/**`, `backend/migrations/**`, or
  `Packages/*/src/**` code. This contract is purely deploy-inert
  tooling (root `package.json` scripts, `docker-compose.dev.yml`,
  `qa/scripts/*.mjs`, `.env.local.example` templates, `LOCAL.md`).

## Constraints

- **Must not collide** with the existing `qa:db` ephemeral Postgres
  (container `inflx-qa-pg`, port 5544). Use a separate container
  (`inflx-dev-pg`) on a separate port (5433).
- **Must use 5433, not 5432** so it never silently clashes with a
  host Postgres install (defensive, matches the qa:db design
  philosophy).
- **Must be persistent** across container restarts (named Docker
  volume `inflx-dev-pgdata`) — restarting the laptop must not wipe
  dev data.
- **Must apply all migrations 001–055** cleanly via the existing
  `backend/scripts/run-NNN.js` precedent (same mechanism as prod;
  proves the local DB matches prod schema).
- **Reset-able cleanly**: `pnpm db:dev:reset` destroys the container
  + volume and recreates from scratch.
- **Loud failures**: the doctor script must never silently say
  "all green" — every check is positive, with a clear FAIL reason
  if it can't be proven.
- **Honest naming**: this is a dev environment, not staging. LOCAL.md
  must be explicit that it does NOT replace staging (which is the
  next gap).
