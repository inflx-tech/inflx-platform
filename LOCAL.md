# LOCAL.md — INFLX local-dev environment

This is the setup for running the **whole platform on your machine**,
isolated from prod. Contract:
[`features/setup-local-dev-environment/`](features/setup-local-dev-environment/).

> **This is NOT staging.** It runs on your laptop; if it dies, so
> does dev. Staging (a second Render env, mirror of prod) is the
> next gap and will land in its own contract.

---

## What you get

| Service     | URL                                                 | Container / Port |
|-------------|-----------------------------------------------------|------------------|
| Backend     | http://localhost:3001                               | `node` :3001     |
| Brand-web   | http://localhost:3002                               | Next.js :3002    |
| Admin-web   | http://localhost:3003                               | Next.js :3003    |
| Postgres    | `postgresql://postgres:dev@localhost:5433/inflx_dev`| `inflx-dev-pg` :5433 (Docker) |

All external services are **mocked**: OTP is always `000000`,
Razorpay test-card payments auto-succeed, Apify returns fixture
profiles, FCM/OneSignal log to console, R2 writes to `/tmp`.

---

## First-time setup

Prereq: Docker Desktop running (same as `pnpm qa:db`).

```bash
# 1. Bring up the persistent dev Postgres
pnpm db:dev:up

# 2. Apply all migrations (001-055) to the dev DB
pnpm db:dev:init

# 3. Drop in the local env files
cp backend/.env.local.example backend/.env             # IMPORTANT — see warning below
cp Packages/brand-web/.env.local.example   Packages/brand-web/.env.local
cp Packages/admin-web/.env.local.example   Packages/admin-web/.env.local

# 4. Confirm the stack is healthy
pnpm dev:doctor   # expect: ALL GREEN

# 5. Start everything
pnpm dev:all
```

> ⚠️ **Warning before step 3:** if your current `backend/.env` has
> production credentials (it does, as of 2026-05-19 — DATABASE_URL
> points at the prod Supabase, which is how migration 055 was applied
> to prod earlier this window), **back it up first**. The
> production migration script (`run-NNN.js`) reads `backend/.env`,
> so if you keep that prod URL anywhere you can re-apply the next
> prod migration when needed.
>
> ```bash
> cp backend/.env backend/.env.prod-backup   # keep prod creds safe
> cp backend/.env.local.example backend/.env # switch to local
> ```

---

## Daily start

```bash
pnpm db:dev:up    # idempotent — fast no-op if already up
pnpm dev:all      # starts backend + brand-web + admin-web concurrently
```

Open http://localhost:3002 (brand) or http://localhost:3003 (admin),
sign up with any phone, OTP is `000000`.

---

## Reset (clean slate)

```bash
pnpm db:dev:reset   # destroys container+volume, recreates, re-runs migrations
```

This wipes all local dev data and gives you a fresh schema-only DB.
Use after a destructive schema test or when state gets weird.

---

## When something is wrong

Run `pnpm dev:doctor`. It checks (positive, loud on failure):

- Docker daemon reachable
- `inflx-dev-pg` container running
- Postgres accepts connections @ :5433
- DB has the full schema (table/view count + `v_searchable_creators`)
- `backend/.env` `DATABASE_URL` points at `localhost:5433` (NOT prod)
- `backend/.env` `*_MOCK` flags all `true`
- Web `.env.local` files exist and point at `localhost:3001`
- Mobile `USE_PRODUCTION` (informational only — see below)

If any check fails, the doctor prints the fix command and exits 1.

---

## Mobile dev (deferred — Phase 2)

`Packages/Mobile/src/config/api.js` has a hardcoded
`USE_PRODUCTION = true` flag that forces all builds to hit the prod
API. This is intentional **for now** — Phase 2 (Maestro mobile
verification) will rewire this properly.

To dev Mobile against the local backend before then:

1. In `Packages/Mobile/src/config/api.js`, set `USE_PRODUCTION = false`.
2. Update `DEV_LAN_IP` to your laptop's LAN IP (Android emulator can
   use `10.0.2.2`; physical device needs your `192.168.x.x`).
3. `pnpm dev:mobile` for Metro, `pnpm dev:android` to run.

**Do NOT commit the flipped flag** until Phase 2's contract lands —
right now `USE_PRODUCTION = true` is the correct production posture.

---

## Coexistence with `pnpm qa:db`

The qa:db lane uses a **different container** (`inflx-qa-pg`),
**different port** (`5544`), and ephemeral volume. They can run
simultaneously — `pnpm qa:db` will not touch your dev DB.

| Lane    | Container       | Port | DB           | Volume                |
|---------|-----------------|------|--------------|-----------------------|
| dev     | `inflx-dev-pg`  | 5433 | `inflx_dev`  | `inflx-dev-pgdata` (persistent) |
| qa:db   | `inflx-qa-pg`   | 5544 | `inflx_test` | ephemeral (`docker rm -f` between runs) |

---

## What's still missing (next contracts)

1. **Staging environment** — a second Render env + Vercel preview +
   separate Supabase, so push-to-prod stops being the only deploy.
   ~2 days when the founder sets up the subscription.
2. **System-A preview maturation** — HTML mockup machinery + before/
   after diff + workflow prediction artifacts in `04-preview/`.
3. **Maestro mobile E2E** — currently zero mobile E2E coverage.
   The biggest residual risk after this contract.
