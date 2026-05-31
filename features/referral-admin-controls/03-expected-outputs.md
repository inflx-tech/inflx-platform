# Expected Outputs — referral-admin-controls (Contract 2)

> Defined BEFORE coding. QA asserts against these. "Compiles" is not output.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| A1 | `GET /settings` → `{ default_pct: 25.00, window_months: 12, updated_at }` | jest: seed row, GET, assert shape |
| A2 | superadmin `PATCH {default_pct:30}` → row updated, `updated_by_admin_id` set | jest: PATCH as superadmin, re-GET = 30.00 |
| A3/D13 | non-superadmin PATCH → `403 FORBIDDEN`, row unchanged | jest: PATCH as reviewer → 403 |
| B4 | `GET /edges` → `{data:[{id,referrer_type,referrer_name,referred_type,referred_name,pct,status,source,started_at,expires_at}], meta:{page,limit,total}}` | jest: seed 1 edge, GET, assert row + names resolved |
| B5 | `POST /edges` (pct omitted) → 201, new edge `pct=default_pct`, `source='admin'`, `created_by_admin_id` set, `status='active'`, `expires_at≈+12mo` | jest: POST as superadmin, query referral_edges |
| B6 | `PATCH /edges/:id {pct:40}` → `pct=40.00`; existing ledger rows unchanged | jest: PATCH, assert pct; assert no ledger mutation |
| B7 | `PATCH /edges/:id {status:'ended'}` → `status='ended'`, `ended_at` set; entity now re-linkable | jest: end edge, then POST new edge for same entity succeeds |
| C8 | `GET /summary` → `{ totals:{earned,pending,paid}, by_referrer:[...] }`; `GET /ledger` rows carry names + `amount=base*pct/100` | jest: seed ledger via engine, assert totals + row amounts |
| C9/D | empty DB → `/edges`,`/ledger` = `{data:[],meta:{total:0}}`; `/summary` zeros | jest: no seed, assert empty + zero |
| D10 | `POST /edges` for entity with active edge → `409`/`422` `VALIDATION_ERROR`, no new row | jest: dup active edge POST → error, count unchanged |
| D11 | `POST /edges` self/circular → `422 VALIDATION_ERROR` | jest: self-edge POST → 422 |
| D12 | `PATCH /settings {default_pct:150}` → `422`, row unchanged | jest: out-of-range PATCH → 422 |

## Data assertions (post-workflow)
- `referral_settings` stays single-row (id=1 guard); `default_pct ∈ [0,100]`.
- `POST /edges` is the ONLY new writer of `referral_edges` and always routes
  through `referral.service.createEdge` (guards + dedup index intact).
- This contract performs **zero** writes to `referral_ledger`,
  `wallet_balance`, `pending_balance`, escrow, or brand tables — verified by a
  baseline-equality assertion (engine money figures unchanged by any admin read).
- Ledger/summary amounts equal the engine's stored values exactly (no
  recomputation drift): `amount = round2(base_amount × pct / 100)`.

## Web (admin-web) expected outputs
- Nav shows a **REFERRALS** section with **Settings / Relationships / Earnings**.
- `/dashboard/referrals/settings`, `/relationships`, `/earnings` each resolve
  for an admin (nav-sweep GREEN), redirect to `/login` without a session
  (role-gate GREEN) — consistent with `/admin/marketing/*` specs.
- Superadmin sees editable Settings + "Create link" + row actions; a
  non-superadmin sees read-only (no save / no create) — and the API enforces it
  regardless of the UI.
- Empty state: with no edges/ledger, each page renders its empty placeholder,
  not a crash or infinite spinner.

## Visual evidence required (UI-governed)
- `04-preview/` HTML mockups for **Settings**, **Relationships** (incl. Create
  modal + row actions), **Earnings** (summary header + ledger table + empty
  state), reviewed via `pnpm preview:open referral-admin-controls` and
  mockup-locked before implementation.
- `06-diff/` before (mockup) / after (Playwright shot of the real admin route)
  with `notes.md`, signed off before the production deploy.
- `pnpm qa` report GREEN (new routes reachable; existing admin/web/API
  workflows unregressed).
