# referral-admin-controls — Contract 2: admin controls (admin-web + API)

> **Contract 2 of 4** in the Referral / Strategic-Partner-Agency feature.
> Builds on Contract 1 (`features/referral-engine/`, deployed + dormant).
> The admin surface to **configure** the referral system, **manage** referral
> relationships, and **audit** the accrual ledger. UI-governed (admin-web).

## Problem / goal
Contract 1 shipped the accrual engine but it is unconfigurable and invisible:
edges can only be created in code/tests, the per-edge `pct` has no default, and
there is no way for an admin to see what was earned. Contract 2 gives the admin:
1. **A knob** — set the global **default referral %** that new referral edges
   inherit (per-edge override still possible).
2. **A manager** — view every referral relationship (edge), and manually
   create / re-percent / end an edge.
3. **An auditor** — a read-only view of the `referral_ledger`: every accrued
   rupee, its source, amount, and pending/paid status, with per-referrer totals.

Locked model carried from Contract 1 (unchanged): referrer (agency|influencer)
earns an admin-set % of the platform's own revenue from a referred entity
(brand|influencer) for a flat 12 months; carved from the platform slice only;
accrues on confirmed revenue only; one active referrer per referred entity.

## Scope
- **In scope:**
  - **Migration `079_referral_settings.sql`**: a single-row `referral_settings`
    table holding the global `default_pct` (seeded with a sensible default,
    e.g. 25.00) + `updated_by_admin_id` / `updated_at`. (The 12-month window
    stays a code constant — `REFERRAL_WINDOW_MONTHS` — not admin-editable.)
  - **Backend admin API** (`referralAdmin.controller.js` +
    `referralAdmin.routes.js`, mounted `/admin/referrals`):
    - `GET  /admin/referrals/settings` — read default_pct.
    - `PATCH /admin/referrals/settings` — set default_pct (superadmin).
    - `GET  /admin/referrals/edges` — paginated/filterable list of edges with
      resolved referrer/referred display names.
    - `POST /admin/referrals/edges` — manually create an edge (superadmin);
      delegates to `referral.service.createEdge` (reuses self/circular/dedup
      guards); `source='admin'`, `created_by_admin_id` set, `pct` defaults to
      `default_pct` when omitted.
    - `PATCH /admin/referrals/edges/:id` — change `pct` and/or `status`
      (e.g. end an edge → `status='ended'`, `ended_at=now()`) (superadmin).
    - `GET  /admin/referrals/ledger` — paginated/filterable ledger rows with
      referrer/referred names; supports `?referrer_type=&source=&payout_status=`.
    - `GET  /admin/referrals/summary` — per-referrer rollups (total earned,
      pending, paid; #edges) for the overview.
  - **admin-web "Referrals" section** (3 pages under `app/dashboard/referrals/`):
    - `settings/` — default-% form (superadmin write; read-only for others).
    - `relationships/` — edges table + filters + "Create link" modal + row
      actions (edit %, end).
    - `earnings/` — ledger table + filters + summary header (totals).
    - Nav section registered in `app/dashboard/layout.js`; `referralApi` added
      to `lib/api.js`.
  - QA: backend jest for the admin endpoints (RBAC, create/guard/dedup, list
    shapes, settings write); admin-web Playwright nav-sweep + role-gate coverage
    consistent with existing `/admin/marketing/*` specs.
- **Explicitly out of scope (later contracts):**
  - The `agency` user role + agency profile + agency wallet + withdrawal (TDS
    194H) + signup-with-code edge creation → **Contract 3**. Until then the
    "Create link" form offers **influencer** referrers only; agency referrers
    appear automatically once Contract 3 seeds them.
  - **Settlement / "mark paid"** of pending (agency) ledger rows → Contract 3
    (needs the agency wallet). The ledger view is read-only this contract;
    influencer-referrer rows are already auto-`paid` by the engine.
  - Influencer "Refer & Earn" mobile screen → **Contract 4**.

## Surfaces touched
- **App(s):** admin-web (new section) + backend (new admin API + 1 migration).
- **Roles involved:** admin only.
  - **Reads** (settings GET, edges/ledger/summary lists) → `requireAnyAdminRole`
    (any admin can view — matches `/admin/marketing` reads).
  - **Writes** (settings PATCH, edge create/edit/end) → `requireAdminRole('superadmin')`
    (matches the marketing-settings-write precedent; founder's daily account
    may need superadmin for these).

## Data / contracts

### New table (migration `079_referral_settings.sql`, additive, idempotent)
**`referral_settings`** — single-row global config.
- `id int primary key default 1 check (id = 1)` (singleton guard)
- `default_pct numeric(5,2) not null default 25.00`
- `updated_by_admin_id uuid null`
- `updated_at timestamptz not null default now()`
- Seed one row `(1, 25.00)` via `INSERT ... ON CONFLICT (id) DO NOTHING`.

### API endpoints (envelope `{success,data,meta}`; pagination `?page=&limit=`)
| Method | Path | Gate | Purpose |
|---|---|---|---|
| GET | `/admin/referrals/settings` | any admin | `{ default_pct, window_months, updated_at }` |
| PATCH | `/admin/referrals/settings` | superadmin | set `default_pct` (0–100) |
| GET | `/admin/referrals/edges` | any admin | list edges + names; filters `status,referrer_type,referred_type,search` |
| POST | `/admin/referrals/edges` | superadmin | create edge (defaults pct to default_pct) |
| PATCH | `/admin/referrals/edges/:id` | superadmin | update pct / end edge |
| GET | `/admin/referrals/ledger` | any admin | list ledger + names; filters `referrer_type,source,payout_status` |
| GET | `/admin/referrals/summary` | any admin | per-referrer rollups + grand totals |

- All amounts rupees `numeric(x,2)`. The engine (Contract 1) is the only writer
  of `referral_ledger`; this contract **reads** it. `POST /edges` is the only
  new writer of `referral_edges`, and it goes through `referral.service`.

### Money / units / attribution
- No change to accrual math or money movement — Contract 2 is config + read +
  manual edge authoring. Existing influencer/escrow/brand payouts untouched.
- `POST /edges` with `pct` omitted → uses `referral_settings.default_pct`.

## Non-functional
- **Auth/role gates:** as table above; enforced at the route (defense-in-depth:
  nav also hides the section for the relevant role where applicable, but the API
  is the source of truth).
- **Failure modes handled:**
  - Create edge that duplicates an active referred entity → engine throws
    (partial unique / guard) → API returns `409`/`422 VALIDATION_ERROR` with a
    human message; the UI surfaces it inline (no crash).
  - Self / circular edge → `422 VALIDATION_ERROR` (from `referral.service`).
  - `default_pct` out of `[0,100]` → `422`.
  - Empty ledger / no edges → lists return `[]` + zero totals (no crash) — the
    expected prod state today (engine dormant).
  - Non-superadmin attempts a write → `403 FORBIDDEN`.
