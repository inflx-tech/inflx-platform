# Feature Spec — Returns Visibility (G-4)

> Brand can now SEE returns; admin gets a returns UI. Visibility only — no settlement
> claw-back (that's G-3, a separate locked decision). Approved in-session by the founder
> ("continue other group … not required my word").

## Problem / goal
Today only the follower (customer) and admin (API-only, no UI) can see returns. The BRAND —
whose product was returned — cannot see returns at all, and admins have no returns screen
(endpoints are reachable only by raw API). Goal: brand read-only returns view + an admin
returns management UI, both on the existing returns data.

## Scope
- In scope: brand read-only returns list; admin returns page (list + approve/reject/mark-refunded
  using existing admin endpoints); nav entries for both.
- Out of scope: refund claw-back / commission + brand-settlement reversal (G-3); any brand
  write actions on returns (brands view only; admin actions).

## Surfaces touched
- backend (read endpoint only), brand-web (brand view + admin page + nav). No mobile, no migration.
- Roles: brand (read-only), admin (manage, requireAnyAdminRole).

## Data / contracts
- No schema change. Uses follower_returns (migration 048) + follower_transactions (brand_id).
- New endpoint: GET /brands/me/returns (brand-scoped, read-only) — joins follower_returns ->
  follower_transactions (ft.id = fr.transaction_id) filtered by ft.brand_id for the auth brand.
- Reuses existing admin endpoints: GET /admin/returns, POST /admin/returns/:id/approve|reject|mark-refunded.

## Non-functional
- Brand isolation: a brand sees ONLY returns on its own transactions (ft.brand_id = own).
- Customer PII masked (first name + last-4 of phone only).
- Admin actions gated requireAnyAdminRole (server); action buttons client-gated as defense-in-depth.
