# Workflow Definition — referral-admin-controls (Contract 2)

> Admin-web + API contract. User-observable steps are admin actions in the
> admin web app; each maps to an API/DB assertion (jest) and a web nav/role
> assertion (Playwright).

## Actor
An authenticated **admin**. Reads are open to any admin role
(`reviewer|finance|superadmin`); writes require `superadmin`.

## Preconditions
- Admin logged into admin-web (existing auth/session).
- Contract 1 engine deployed; migration 078 applied; migration 079
  (`referral_settings`) applied with its seed row.
- At least one influencer exists (to be a referrer / referred in manual edge
  creation tests). No agency exists yet (Contract 3).

## Workflow steps (observable)

### A. Settings — the default %
1. Admin opens **Referrals → Settings**. The page loads
   `GET /admin/referrals/settings` → shows current `default_pct` (seed 25.00)
   and the fixed 12-month window (read-only).
2. A **superadmin** edits the % to e.g. `30.00` and saves →
   `PATCH /admin/referrals/settings` → `referral_settings.default_pct` updated,
   `updated_by_admin_id`/`updated_at` stamped → success toast, value persists on
   reload.
3. A **non-superadmin** sees the field disabled / save hidden; a forced PATCH
   returns `403`.

### B. Relationships — manage edges
4. Admin opens **Referrals → Relationships** →
   `GET /admin/referrals/edges` → table of edges (referrer → referred, %,
   started, expires, status, source). Filters by `status` / `referrer_type` /
   `search` re-query the endpoint.
5. Superadmin clicks **Create link**, picks an **influencer** referrer + a
   referred brand/influencer, leaves % blank → `POST /admin/referrals/edges`
   → engine `createEdge` runs (pct defaults to `default_pct`, `source='admin'`,
   `created_by_admin_id` set) → new active edge appears in the table.
6. Superadmin **edits %** on a row → `PATCH /admin/referrals/edges/:id` →
   `pct` updated (applies to future accruals; past ledger rows unchanged).
7. Superadmin **ends** an edge → `PATCH …/:id {status:'ended'}` →
   `status='ended'`, `ended_at=now()`; the partial unique index frees the
   referred entity for a new active referrer.

### C. Earnings — audit the ledger
8. Admin opens **Referrals → Earnings** →
   `GET /admin/referrals/summary` (header totals: earned / pending / paid) +
   `GET /admin/referrals/ledger` (rows: referrer, referred, source, base, %,
   amount, payout_status, date). Filters by `source` / `payout_status` /
   `referrer_type`.
9. With the engine dormant in prod (no edges), all three lists return empty +
   zero totals → the page renders its empty state, no crash.

### D. Guards (negative)
10. `POST /edges` duplicating an entity that already has an active edge →
    `409`/`422` with a clear message; UI shows it inline, table unchanged.
11. `POST /edges` self/circular → `422 VALIDATION_ERROR`.
12. `PATCH /settings` with pct `>100` or `<0` → `422`.
13. Any write by a non-superadmin → `403 FORBIDDEN`.

## Success definition
- Settings round-trips: a superadmin's `default_pct` change persists and is the
  value a subsequently-created edge inherits.
- Edge create/edit/end go through `referral.service` (guards intact) and reflect
  in the list; the dedup index still guarantees ≤1 active edge per referred
  entity.
- Ledger + summary read the engine's `referral_ledger` accurately (amounts =
  engine's), are filterable, and render an empty state cleanly when dormant.
- RBAC holds: reads any-admin, writes superadmin-only (403 otherwise).
- `pnpm qa` stays GREEN; admin nav-sweep reaches the 3 new routes; role-gate
  matrix covers the section.

## Failure / edge workflows
- Backend down / API error → pages show a "Failed to load" state (matches the
  marketing pages' pattern), never a white screen.
- Engine/guard rejects a create → surfaced inline; no partial state.
- This contract never writes `referral_ledger` and never moves money — a bug
  here cannot mis-pay; worst case is a mis-set `default_pct` (visible + editable)
  or a wrongly-created edge (endable).
