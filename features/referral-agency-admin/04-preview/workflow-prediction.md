# Workflow prediction — referral-agency-admin

## Trigger
Admin opens **Referrals → Agencies** in admin-web, or calls `GET /admin/agencies`.

## Steps
1. Page loads `GET /admin/agencies?status=pending` (default) → pending agencies.
2. Admin Approves / Rejects a pending row → `PATCH /admin/agencies/:id/status`
   (reused from C3a) → status persists, agency notified.
3. Admin switches filter (All / Approved) → list shows wallet, referral earnings,
   code, and active-referral count per agency.
4. Search by name re-queries.

## End state
- Pending agencies are approvable/rejectable from the UI.
- Approved agencies are visible with accurate wallet/earnings/code/active-edges.

## Edge cases
- Unauthenticated → `/login` (layout guard) / 401.
- Non-reviewer approve attempt → 403 (UI may still show button for non-reviewer
  admins; API is the enforcer — acceptable, matches existing admin pages).
- Reject without reason → 422 inline.
- Agency without a code yet → `code` null → "—".
- No agencies → empty state.

## What changes vs current behaviour
- Today: agency approval endpoints exist (C3a) but there is NO admin UI — only
  raw API. Admins can't practically onboard agencies.
- After: a full Agencies page; agencies become onboardable + overseeable.
- Files: backend `getAgencies` + `GET /admin/agencies` route; admin-web
  `referrals/agencies/page.js`, `layout.js` nav, `lib/api.js`.

## Blast radius
- Production-impacting: Render (1 read GET) + Vercel (admin page). No migration,
  no money movement, no mobile/OTA, no Maestro gate.
- Rollback: remove nav entry / endpoint; nothing persisted.
- Affected users: admins only.

## Open questions
- None blocking. Scope delegated ('take your best one'). Mockup in `mockups/` is
  the review artifact for mockup-lock.
