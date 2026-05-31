# Impact Analysis — referral-admin-controls (Contract 2)

> Generated BEFORE implementation. Reviewed against the lock before Step 7.

## Chat verdict (terse)
**New admin section + read/config API on top of the dormant referral engine —
zero change to money math or existing workflows.** New migration (079, additive
single-row settings), new admin endpoints, new admin-web pages. The only new
writer of `referral_edges` is the guarded `POST /edges`; `referral_ledger` and
all wallet/escrow/brand money paths are read-only here. Production-impacting
(Render API + Vercel admin-web + 1 migration) but additive and reversible.

## Affected files (read or change)
- **backend (new):**
  - `backend/migrations/079_referral_settings.sql` — single-row settings table.
  - `backend/scripts/run-079.js` — one-off runner (per run-078 precedent).
  - `backend/src/controllers/referralAdmin.controller.js` — 7 handlers.
  - `backend/src/routes/referralAdmin.routes.js` — routes + RBAC gates.
  - `backend/tests/referral-admin.test.js` — endpoint/RBAC/guard tests.
- **backend (changed, additive):**
  - `backend/src/routes/index.js` — mount `/admin/referrals` (one line, mirrors
    the `/admin/marketing` mount at line ~80).
- **admin-web (new):**
  - `Packages/admin-web/app/dashboard/referrals/settings/page.js`
  - `Packages/admin-web/app/dashboard/referrals/relationships/page.js`
  - `Packages/admin-web/app/dashboard/referrals/earnings/page.js`
- **admin-web (changed, additive):**
  - `Packages/admin-web/app/dashboard/layout.js` — add REFERRALS nav section.
  - `Packages/admin-web/lib/api.js` — add `referralApi` namespace.
- **service reused (no change):** `backend/src/services/referral.service.js`
  (`createEdge`, `getOrCreateCode`) — called by the new controller.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET/PATCH | `/admin/referrals/settings` | new | admin-web Settings |
| GET/POST | `/admin/referrals/edges` | new | admin-web Relationships |
| PATCH | `/admin/referrals/edges/:id` | new | admin-web Relationships |
| GET | `/admin/referrals/ledger` | new | admin-web Earnings |
| GET | `/admin/referrals/summary` | new | admin-web Earnings |

## Affected workflows (regression surface)
- Existing `/admin/marketing/*` + admin nav-sweep + role-gate specs must stay
  GREEN (shared layout.js edit + lib/api.js edit).
- No existing backend money workflow touches the new files; engine (Contract 1)
  suites stay GREEN unchanged.

## Migration / deploy / OTA impact
- **New migration 079** → `run-079.js`; additive single-row table, idempotent
  seed. No destructive change.
- **`git push`** → Render (backend API) + Vercel (admin-web). **No OTA / no
  mobile.**
- **Deploy posture: PRODUCTION-IMPACTING.** Surfaced for explicit go. The new
  admin section is visible to admins immediately; the engine stays dormant until
  edges exist, so the Earnings page shows an empty state and Settings just holds
  the default %.

## Risk notes
- Writes are superadmin-gated + routed through the already-tested
  `referral.service` guards; the dedup index prevents double-active edges.
- Read endpoints join to brand/influencer names — must handle missing/odd rows
  without 500 (LEFT JOIN + COALESCE display name).
- Shared-file edits (`layout.js`, `lib/api.js`, `routes/index.js`) are additive
  and staged by explicit path (parallel-window git hygiene).
- Reversibility: drop-in additive; rollback = remove nav entry / leave 079 in
  place (inert). No data migration, no backfill.
- No enum change, no auth-model change (the `agency` role is Contract 3).
