# Workflow Definition — Returns Visibility (G-4)

## Actor
Brand (read-only) and admin (manage).

## Preconditions
At least one follower_return exists on a transaction belonging to the brand.

## Workflow steps (user-observable)
1. Brand opens dashboard → "Returns" nav → sees a list of returns on THEIR sales, with
   status pills (requested/approved/received/rejected/refunded), item, amount, reason, dates,
   masked customer. Filter open/closed/all. It is clearly marked "view only".
2. Brand sees only its own returns — none from other brands.
3. Admin opens admin → "Returns" → sees all returns with status tabs; can Approve (with
   refund amount), Reject (with notes), or Mark refunded (razorpay ref) via the existing
   admin endpoints.

## Success definition
- Brand can see its returns (read-only); admin can list and action returns from a UI.

## Failure / edge workflows
- No returns → empty state, no crash.
- Non-brand / non-admin tokens are gated out by role middleware.
- Brand cannot mutate returns (no brand write endpoint exists).
