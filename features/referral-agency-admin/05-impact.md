# Impact Analysis — referral-agency-admin

## Chat verdict (terse)
**Adds the admin-web Agencies page + one read-only `GET /admin/agencies`
endpoint so admins can approve/oversee agencies in the UI (C3a shipped only the
endpoints).** No migration, no schema change, no money movement — approve/reject
reuses C3a's existing PATCH. Production-impacting only as: Render (1 new GET) +
Vercel (admin-web page). Additive, reversible (remove nav entry).

## Affected files
- **backend (changed, additive):**
  - `backend/src/controllers/admin.controller.js` — add `getAgencies` (list +
    filters + wallet/earnings/code/active_edges) + export.
  - `backend/src/routes/admin.routes.js` — `GET /agencies` (any admin).
  - `backend/tests/referral-agency.test.js` (extend) or a new
    `referral-agency-admin.test.js` — list endpoint tests.
- **admin-web (new):**
  - `Packages/admin-web/app/dashboard/referrals/agencies/page.js`.
- **admin-web (changed, additive):**
  - `app/dashboard/layout.js` — add **Agencies** nav entry under REFERRALS.
  - `lib/api.js` — `referralApi.listAgencies` + `updateAgencyStatus`.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | `/admin/agencies` | new (read-only) | admin-web Agencies page |
| PATCH | `/admin/agencies/:id/status` | reused (C3a) | admin-web Agencies page |

## Affected workflows (regression surface)
- Existing admin nav-sweep + role-gate specs (shared `layout.js` + `lib/api.js`
  edits — additive).
- C3a agency suites stay GREEN (the list endpoint only reads; PATCH unchanged).

## Migration / deploy / OTA impact
- **No migration.** `git push` → Render (1 GET) + Vercel (admin-web). No OTA,
  no mobile, **no Maestro gate** (admin-web is not Mobile-governed).
- **Deploy posture: PRODUCTION-IMPACTING** (Render + Vercel). Low blast radius:
  one read endpoint + one admin page.

## Risk notes
- Read-only endpoint with LEFT JOINs (code) + a scalar subquery (active_edges) —
  must not 500 on agencies without a code/edges (COALESCE / LEFT JOIN).
- Shared-file edits additive, staged by explicit path (parallel-window hygiene).
- Reversibility: remove the nav entry / endpoint; nothing persisted.
