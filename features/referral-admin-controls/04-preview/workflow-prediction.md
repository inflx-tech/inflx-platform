# Workflow prediction — referral-admin-controls (Contract 2)

## Trigger
An admin opens the new **Referrals** section in admin-web (Settings /
Relationships / Earnings), or calls the `/admin/referrals/*` API.

## Steps
1. **Settings** — admin reads `default_pct` (GET); a superadmin sets it (PATCH)
   → `referral_settings` row updated + stamped.
2. **Relationships** — admin lists edges (GET) with resolved names; a superadmin
   creates a link (POST → `referral.service.createEdge`, pct defaults to
   `default_pct`, `source='admin'`), edits % or ends an edge (PATCH).
3. **Earnings** — admin reads `summary` (totals) + `ledger` (rows) the engine
   wrote; filter by source / payout_status / referrer_type.

## End state
- `referral_settings.default_pct` reflects the latest superadmin value.
- New admin-created edges exist as `active`, `source='admin'`, pct = chosen or
  default, expiring +12 months; visible in the list.
- Ended edges are `status='ended'` with `ended_at`, freeing the referred entity.
- Earnings views accurately mirror `referral_ledger` (no recomputation); empty +
  zeroed when the engine is dormant.

## Edge cases
- **Unauthenticated** → redirect to `/login` (admin layout guard) / API 401.
- **Non-superadmin write** → Save/Create hidden in UI; API returns 403.
- **Duplicate active edge** → engine rejects → API 409/422 → inline error.
- **Self / circular edge** → 422 VALIDATION_ERROR.
- **default_pct out of [0,100]** → 422.
- **Empty data** → empty states, never a crash/spinner-forever.
- **Name lookup miss** (deleted entity) → LEFT JOIN + fallback label, no 500.

## What changes vs current behaviour
- Today: the referral engine is deployed but unconfigurable + invisible — no
  default %, edges only seedable in code, ledger unviewable.
- After: admins configure the default %, manage edges, and audit earnings from
  admin-web.
- Files touched (preview): migration 079 + run-079; `referralAdmin.controller`/
  `routes` + mount in `routes/index.js`; admin-web `referrals/{settings,
  relationships,earnings}/page.js`, `layout.js` nav, `lib/api.js`.

## Blast radius
- Production-impacting: Render backend (new API) + Vercel admin-web (new pages) +
  DB migration 079 (additive single-row). **No OTA / no mobile.**
- Rollback: additive — remove the nav entry / leave 079 inert. No backfill, no
  money-path change (this contract never writes the ledger or moves funds).
- Affected users: admins only (role-gated; writes superadmin-only).

## Open questions (clear before lock)
- None blocking. Scope delegated by founder ("pls proceed"): single global
  default %, 3 screens, manual edge creation now, settlement deferred to C3.
  Mockups in `mockups/` are the review artifact for mockup-lock.
