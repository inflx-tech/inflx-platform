# Expected outputs — setup-local-dev-environment

## Files created (all deploy-inert)

```
docker-compose.dev.yml                        (root)
qa/scripts/dev-db-config.mjs                  constants (container/port/url)
qa/scripts/dev-db-up.mjs                      docker-compose up -d
qa/scripts/dev-db-down.mjs                    docker-compose stop (keeps volume)
qa/scripts/dev-db-reset.mjs                   compose down -v + up + init
qa/scripts/dev-db-init.mjs                    runs migrations 001-055 in order
qa/scripts/dev-doctor.mjs                     verifies the whole stack
backend/.env.local.example                    template for local backend env
Packages/brand-web/.env.local.example         NEXT_PUBLIC_API_URL=localhost
Packages/admin-web/.env.local.example         NEXT_PUBLIC_API_URL=localhost
LOCAL.md                                       founder-facing setup guide
```

## Files modified

```
package.json (root)  +db:dev:up, +db:dev:down, +db:dev:reset,
                     +db:dev:init, +dev:doctor scripts
```

## Files NOT modified (out of scope for this contract)

- Any `backend/src/**` (no startup-guard in this contract — keep
  deploy-inert; can be a follow-up if needed).
- Any `backend/migrations/**`.
- Any `Packages/*/src/**`, `app/`, `components/`, `lib/`, `screens/`,
  `services/` (governed paths — untouched).
- `backend/.env` itself is NOT touched by the contract; founder copies
  `.env.local.example` over it manually (one-time choice).
- `Packages/Mobile/src/config/api.js` USE_PRODUCTION flag is NOT
  touched (Phase 2).

## Visible runtime behaviour (after first-time setup)

- `docker ps` shows `inflx-dev-pg` running on `0.0.0.0:5433->5432/tcp`.
- `docker volume ls | grep inflx-dev-pgdata` shows the persistent
  volume.
- `psql postgresql://postgres:dev@localhost:5433/inflx_dev` connects;
  `\dt` lists ~50+ tables; `\dv` lists `v_searchable_creators`.
- `pnpm dev:all` brings up:
  - http://localhost:3001/v1/health  → `{success:true,...}`
  - http://localhost:3002/           → brand-web login screen
  - http://localhost:3003/           → admin-web login screen
- Backend logs read from `backend/.env`'s LOCAL DATABASE_URL (no
  prod traffic).
- OTP sent during login flow is always `000000` (OTP_MOCK=true).
- Razorpay payments succeed instantly via the test webhook
  (RAZORPAY_MOCK=true).
- `pnpm dev:doctor` exit 0 with all green checks.

## Expected doctor output (golden path)

```
[dev-doctor] === INFLX local-dev sanity check ===
[dev-doctor] ✓ Docker daemon reachable
[dev-doctor] ✓ inflx-dev-pg container UP (postgres:16-alpine)
[dev-doctor] ✓ Postgres accepts connections @ localhost:5433
[dev-doctor] ✓ DB inflx_dev exists; N tables, M views (migrations 001-055 applied)
[dev-doctor] ✓ backend/.env DATABASE_URL → localhost:5433 (LOCAL — safe)
[dev-doctor] ✓ backend/.env *_MOCK flags set (OTP|Razorpay|Apify|FCM|OneSignal|R2)
[dev-doctor] ✓ Packages/brand-web/.env.local → http://localhost:3001/v1
[dev-doctor] ✓ Packages/admin-web/.env.local → http://localhost:3001/v1
[dev-doctor] (i) Packages/Mobile USE_PRODUCTION=true — flip to false in Phase 2 (Maestro)
[dev-doctor] === ALL GREEN — start with: pnpm dev:all ===
[dev-doctor]   backend     http://localhost:3001
[dev-doctor]   brand-web   http://localhost:3002
[dev-doctor]   admin-web   http://localhost:3003
[dev-doctor]   db (psql)   postgresql://postgres:dev@localhost:5433/inflx_dev
```

## Expected doctor output (failure path — backend still pointing prod)

```
[dev-doctor] ✗ backend/.env DATABASE_URL does NOT contain localhost:5433
[dev-doctor]   current value looks like: ***.supabase.co (PROD — HAZARD)
[dev-doctor]   fix: cp backend/.env.local.example backend/.env  (back up the
                 current .env first if it contains prod credentials you need)
[dev-doctor] === RED — 1 failed check ===
exit 1
```
