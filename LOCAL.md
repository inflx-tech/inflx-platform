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

## Mobile dev with Maestro (Phase 2 sub-contract 3 onward)

INFLX ships three Android variants from one RN codebase:
`com.inflx.brand`, `com.inflx.influencer`,
`com.inflx.followers`. **Maestro is the mobile E2E lane** (parallel
to Playwright on web).

### One-time install

1. **Maestro CLI:**
   - Windows: download the latest release from
     [github.com/mobile-dev-inc/maestro/releases](https://github.com/mobile-dev-inc/maestro/releases)
     and add the `bin/` directory to PATH. (Scoop alternative:
     `scoop install maestro`.)
   - macOS: `brew tap mobile-dev-inc/tap && brew install maestro`
   - Verify: `maestro -v`
2. **Android Platform Tools (`adb`)** — required for device control:
   - Download from
     [developer.android.com/studio/releases/platform-tools](https://developer.android.com/studio/releases/platform-tools)
     and add to PATH.
   - Verify: `adb version`
3. **Get a device or emulator running:**
   - **USB device:** enable Developer Options → USB debugging on the
     phone, plug in, accept the RSA prompt. `adb devices` should
     list it.
   - **Android emulator** (Android Studio installed):
     `emulator -list-avds` then `emulator -avd <name>`. `adb devices`
     should list it as `emulator-5554`.
4. **Install the follower app on the device:**
   ```bash
   cd Packages/Mobile
   pnpm android:follower
   ```

### Daily run

```bash
pnpm qa:maestro:doctor    # verify Maestro + ADB + device + app readiness
pnpm qa:maestro           # run all qa/maestro/flows/*.yaml
```

The doctor must be green before the orchestrator will run. Output
lands in `qa/artifacts/qa-maestro/<timestamp>/` (gitignored;
regenerable).

### Where things live

- **Flow YAML files:** `qa/maestro/flows/*.yaml` — durable test
  definitions, committed. Naming: `NN-<name>.yaml` (numeric prefix
  for sort order).
- **Lane convention metadata:** `qa/maestro/{README.md, config.yaml}`.
- **Per-run output:** `qa/artifacts/qa-maestro/<ts>/<flow-name>/` —
  Maestro logs + any `takeScreenshot:` PNGs.

### Mobile dev mode (`api-overrides.js` pattern, Phase 2 sub-contract 4)

`Packages/Mobile/src/config/api.js` reads optional overrides from
`Packages/Mobile/src/config/api-overrides.js`. The override file is
**COMMITTED** with `export default {};` (empty defaults), so the
default behaviour preserves the prior hardcoded `USE_PRODUCTION=true`:
both debug AND release builds hit `PRODUCTION_API_URL` /
`PRODUCTION_BRAND_WEB_URL`.

**Release builds (`__DEV__ === false`) always use PRODUCTION** —
overrides are read only in `__DEV__` debug builds. End users see
zero behaviour change regardless of what `api-overrides.js`
contains in your local working tree.

#### To redirect a debug APK at your local backend

1. Edit `Packages/Mobile/src/config/api-overrides.js`:
   ```js
   export default {
     API_BASE_URL: 'http://10.0.2.2:3001/v1',   // Android emulator
     BRAND_WEB_URL: 'http://10.0.2.2:3002',
     // Physical phone over LAN — use your laptop's IP:
     // API_BASE_URL: 'http://192.168.x.y:3001/v1',
   };
   ```
2. Keep your local edits OUT of commits:
   ```bash
   git update-index --skip-worktree Packages/Mobile/src/config/api-overrides.js
   ```
3. Start Metro: `cd Packages/Mobile && pnpm start`.
4. Run the debug APK on your device/emulator (`pnpm android:follower`,
   etc.) — it now hits local backend (assumes `pnpm dev:all` is
   running).

To start tracking changes to the file again:
```bash
git update-index --no-skip-worktree Packages/Mobile/src/config/api-overrides.js
```

#### Why this pattern (not gitignore)

- **Default behaviour preserved** — empty committed file = current
  prod-pointing behaviour exactly.
- **No Metro dynamic-require fragility** — the file always exists,
  static `import overrides from './api-overrides';` resolves
  cleanly at bundle time.
- **Safe even if accidentally committed** — release builds ignore
  overrides regardless of their content.

### Per-flavor app install

```bash
cd Packages/Mobile
pnpm android:brand        # com.inflx.brand (debug)
pnpm android:influencer   # com.inflx.influencer (debug)
pnpm android:follower     # com.inflx.followers (debug)
```

The smoke flow targets the follower variant by default. To target a
different variant, edit a flow's `appId:` header.

---

## Coexistence with `pnpm qa:db`

The qa:db lane uses a **different container** (`inflx-qa-pg`),
**different port** (`5544`), and ephemeral volume. They can run
simultaneously — `pnpm qa:db` will not touch your dev DB.

| Lane    | Container       | Port | DB           | Volume                |
|---------|-----------------|------|--------------|-----------------------|
| dev     | `inflx-dev-pg`  | 5433 | `inflx_dev`  | `inflx-dev-pgdata` (persistent) |
| qa:db   | `inflx-qa-pg`   | 5544 | `inflx_test` | ephemeral (`docker rm -f` between runs) |

> ⚠️ **qa:db is a once-per-fresh-boot operation on this hardware.**
> `pnpm qa:db` is the heaviest lane (~4 min clean; 382 backend
> tests × 28 suites against a real Postgres). On this Windows +
> Docker + WSL2 box it reliably passes **once** after a fresh
> boot, but a **second consecutive run saturates the host** and
> tests start timing out (the Windows/Docker socket layer, not
> INFLX code — every failure is a test-DB timeout, never a
> product defect). This is NOT fixable from app/test code
> (`features/qa-db-env-resilience` proved it — pg/pool tuning
> made zero difference; the pool-error diagnostics never fired).
>
> **The discipline:** before any release that needs qa:db
> evidence, **restart Windows → run `pnpm qa:db` once → capture
> the GREEN → proceed.** Don't re-run it back-to-back expecting
> determinism; it won't, and that's a host ceiling, not a bug.
> (The main `pnpm qa` lane is light and unaffected — run it
> freely.)

---

## What's still missing (next contracts)

1. **Staging environment** — a second Render env + Vercel preview +
   separate Supabase, so push-to-prod stops being the only deploy.
   ~2 days when the founder sets up the subscription.
2. **System-A preview maturation** — HTML mockup machinery + before/
   after diff + workflow prediction artifacts in `04-preview/`.
3. **Maestro mobile E2E** — currently zero mobile E2E coverage.
   The biggest residual risk after this contract.
