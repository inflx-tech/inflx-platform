# Impact — billing-tier-features-and-prices (Phase A10)

## Changes
- 1 migration (M061): 3 new tables, 3 new enums, 1 new column on brand_subscriptions, 4+52+4 seed rows, backfill of existing brand_subscriptions.
- 1 new backend service (entitlements.service.js).
- 1 new backend controller (features.controller.js, 10 endpoints).
- 1 extended controller (subscription.controller.js — getSubscription returns entitlements).
- 11 new admin routes wired in admin.routes.js.
- 3 brand-web admin pages (1 rewritten, 2 new).
- 4 brandApi additions in lib/api.js (12 methods total under adminApi).
- 1 nav entry added in admin layout.
- 1 nav-sweep route added.

## Blast radius
- **Backend boots OK** — entitlements service reads new tables; if tables don't exist (pre-migration), every call falls back to defaults (no crash).
- **brand subscription endpoint** — extended to include `entitlements{}` in payload; existing keys preserved. Frontend ignores unknown fields. Zero breaking change for brand-web.
- **Admin tier editor changes** — the inline-edit-all-tiers page is GONE; replaced with click-into per-tier editor. Admin retrains: 1 minute. No data loss.
- **Window B parallel work** — only files touched outside backend are admin pages + nav. No brand-web flow changes; Window B's redesign of brand-side surfaces unaffected.

## Rollback
1. Revert the commit.
2. Run inverse SQL on prod Supabase: DROP TABLE tier_features; DROP TABLE subscription_prices; DROP TABLE features; ALTER TABLE brand_subscriptions DROP COLUMN subscription_price_id; DROP TYPE billing_period; DROP TYPE feature_category; DROP TYPE feature_type.
3. Vercel + Render auto-redeploy the prior image.

Safe — no other code reads these tables in A10.

## Risks
- **Render auto-deploy failure** — past pattern (80ba29c earlier today) suggests Render's free tier sometimes fails deploys with "internal system error". Mitigation: after push, monitor Render dashboard; if auto-deploy fails, manually re-deploy.
- **Migration M061 has 50+ INSERT statements** — could take ~10s on prod Supabase. Acceptable; wrapped in single transaction.
- **The legacy quotaCheck middleware still uses subscription_tiers columns** — when admin edits per-feature quotas in the new tier editor, those changes don't take effect until A12 migrates the middleware. Admin-visible discrepancy until then. Mitigation: both surfaces (legacy columns AND tier_features) are admin-editable in A10; admin can keep them in sync until A12 ships.

## Pre-push checklist
1. pnpm qa GREEN with +1 nav-sweep route. Target 76/76.
2. M061 applied locally; sanity probes confirm tables + 13 + 52 + 4 + backfill.
3. backend boots (require('./src/app') exits 0).
4. gov-check exit 0 with Rules 1 + 3 + 4 satisfied (UI-governed: mockup_locked + 06-diff/notes.md).
