# Workflow Definition — referral-agency-admin

> admin-web + 1 API endpoint. Steps are admin actions mapped to API/DB + web
> assertions.

## Actor
Authenticated **admin**. List read = any admin role; approve/reject = reviewer+.

## Preconditions
- C3a deployed (agencies + status endpoints live; `agency` role exists).
- Admin logged into admin-web.

## Workflow steps (observable)
1. Admin opens **Referrals → Agencies** → `GET /admin/agencies?status=pending`
   → table of pending agencies (name, contact, city, joined).
2. Admin clicks **Approve** on a row → `PATCH /admin/agencies/:id/status
   {status:'approved'}` → row moves out of Pending; agency `users.status
   ='approved'`; the agency can now withdraw.
3. Admin clicks **Reject** → enters a reason → `PATCH … {status:'rejected',
   reason}` → row marked rejected; agency notified.
4. Admin switches the filter to **Approved** (or **All**) →
   `GET /admin/agencies?status=approved` → table shows each agency's
   `wallet_balance`, `referral_earned_total`, referral `code`, and
   `active_edges` count.
5. Admin searches by name → `?search=` re-queries.

## Success definition
- Pending agencies are listed and can be approved/rejected from the UI; status
  changes persist (verified via re-fetch).
- Approved view shows correct wallet/earnings/code/active-edge figures pulled
  from the live tables (no recomputation drift; equals the agency's own
  `/agencies/me`).
- RBAC: any admin can view; only reviewer+ can approve/reject (others 403 at the
  API regardless of UI).
- Empty state renders cleanly; `pnpm qa` GREEN, admin nav-sweep + role-gate
  reach the new route.

## Failure / edge workflows
- Backend error → "Failed to load" state (matches existing admin pages).
- Reject with no reason → 422 surfaced inline; no status change.
- Agency without a code yet → `code` null → UI shows "—".
