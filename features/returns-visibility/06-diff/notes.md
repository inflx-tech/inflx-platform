# 06 — Implementation / diff notes (Returns Visibility, G-4)

Additive, read-only visibility — no mockup (a standard list view matching the existing
fulfillment/payouts pages). Visual approval implicit in the founder's "continue … not
required my word" go.

## What was implemented
- Backend: `listBrandReturns` in returns.controller.js → `GET /brands/me/returns?filter=open|closed`
  (new brandRouter in returns.routes.js, mounted /brands/me in routes/index.js). Joins
  follower_returns → follower_transactions (ft.id = fr.transaction_id), filtered ft.brand_id =
  the authenticated brand. Read-only; PII masked (first name + last-4 phone).
- Brand UI: app/dashboard/returns/page.js — open/closed/all filter, status pills, masked
  customer, "view only" banner; matches the fulfillment page design. Nav entry added.
- Admin UI: app/admin/returns/page.js — status tabs + approve/reject/mark-refunded modals over
  the EXISTING admin endpoints; matches payouts page style. Nav entry under Finance.
- lib/api.js: brandApi.getReturns + adminApi.getReturns/approveReturn/rejectReturn/markReturnRefunded
  (paths verified against returns.routes.js adminRouter).

## What matches spec
Brand read-only visibility + admin management UI, no claw-back (G-3 excluded). Reviewer confirmed
brand isolation (ft.brand_id), no cross-brand leak, admin paths match, existing flows intact.

## What diverged / deferred
- Settlement/commission claw-back on refund = G-3 (separate locked decision), NOT in this change.

## What to check after deploy
- Brand → Returns nav → sees only its own returns; cannot action them.
- Admin → Returns → list + approve/reject/mark-refunded work.
- Existing follower return flow + existing admin return endpoints unaffected.
