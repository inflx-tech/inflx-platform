# Workflow — fix-tier-list-and-create-flow (A10.5)

## Actor
Admin user (any admin role) on the existing `/admin/pricing/tiers` page.

## Preconditions
- A10 deployed (commit `1004872`) — features catalog + tier_features + subscription_prices live on prod Supabase.
- M061 applied on prod (4 tiers × 13 features = 52 entitlement rows + 4 monthly prices already there).
- Admin is logged in.

## Workflow A — fix the empty tier list (no user action; lands on deploy)
1. Vercel + Render redeploy A10.5.
2. Backend now mounts `GET /admin/subscription-tiers` (was 404 since A7-admin).
3. Admin reloads `/admin/pricing/tiers` → page hits the endpoint → returns 200 with 4 tier rows → table populates with `Edit` buttons.

## Workflow B — create a new tier
1. Admin clicks "+ New tier" at the top-right.
2. Modal opens with 3 inputs.
3. Admin types `tier_key=starter`, `name=Starter`, `description=A trial tier for new salons`.
4. Click "Create + edit" → POST `/admin/subscription-tiers`.
5. Backend transaction: inserts tier + 13 tier_features rows (included=false; quotas at catalog default) + 1 monthly price at ₹0. Returns 201 with the new tier.
6. Frontend navigates to `/admin/pricing/tiers/starter` — the 3-section detail editor.
7. Admin sets the monthly + yearly price, ticks the features the tier includes, enters quota numbers, picks discover_filter scope (city/state/all_india + niches limit), picks open_group_broadcast scope + max_recipients.
8. Click "Save changes" → all of that persists via the existing A10 endpoints.

## Workflow C — fix surfaces API failures, no longer silent
- If `/admin/subscription-tiers` ever fails again (auth issue, controller error), the page now shows a red banner with the actual error code + message instead of pretending the list is just empty.

## Success
- pnpm qa GREEN.
- After deploy, the production tier list page populates with the 4 seeded tiers.
- "+ New tier" button visible, modal opens, create-then-edit flow works end-to-end against prod Supabase.

## Failure modes
- Duplicate slug → 409 CONFLICT, modal shows the message, admin picks a different slug.
- Invalid slug (uppercase, starts with digit, special chars) → 422 VALIDATION_ERROR before INSERT.
- Backend transaction fails mid-step → ROLLBACK; tier not partially created; admin sees the error.
