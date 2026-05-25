# Workflow — billing-tier-features-and-prices (Phase A10)

## Actor
Admin operator using `/admin/pricing/*` pages.

## Preconditions
- M058 + M059 + M060 applied (subscription_tiers, categories, features_json all live).
- pnpm qa GREEN baseline (75/75 after A9+OTP fix).

## Workflow A — Apply migration
1. Operator runs `node backend/scripts/run-061.js` (local first).
2. Script outputs: 3 tables created, 3 enums, 13 features rows, 52 tier_features rows, 4 subscription_prices rows, brand_subscriptions backfill stats.
3. Re-run: zero state delta.
4. pnpm qa stays green (no code reads the new tables yet at this step).

## Workflow B — Admin features catalog
1. Admin opens `/admin/pricing/features`.
2. Page lists 13 catalog rows grouped by category.
3. Each row shows: label, type, default quota, is_enforced indicator (false on all 13 today), active toggle.
4. Click a row → inline edit: label, description, default_quota (for quota type), active.
5. "+ Add feature" opens a modal: feature_key (slug, immutable), category, type, unit, default_quota, label, description. Save creates a new row.
6. Soft-delete (active=false) — feature stops appearing on tier editor but stays in DB.

## Workflow C — Admin tier editor (rebuilt)
1. Admin opens `/admin/pricing/tiers` — list page shows 4 tiers + "+ New tier".
2. Click a tier → opens `/admin/pricing/tiers/[tier_key]` detail editor with 3 sections:
   - **Section A Basics** — display name, description, sort order, active.
   - **Section B Pricing** — table of prices (monthly + yearly rows). Each row editable: period, ₹ price, active. Discount preview = `1 − (yearly / (12 × monthly))`.
   - **Section C Features** — features grouped by category. Per row: included checkbox + quota input (if quota type) + config editor (if config type — hardcoded for discover_filter + open_group_broadcast).
3. "Save changes" writes tier row + all 13 tier_features rows + all price rows in one PATCH transaction.

## Workflow D — Brand subscription read (extended)
1. `GET /brands/me/subscription` already returns subscription + tier + usage.
2. NEW: response payload now also includes `entitlements: {feature_key: {included, quota_value, config, feature_type}}` for every feature the tier has.
3. Brand-web page can render from entitlements (A11 will replace today's hardcoded bullets).

## Success
- pnpm qa GREEN.
- Admin can edit any cell in tier_features and the change persists.
- Brand's GET /subscription includes entitlements matching their tier.
- No production endpoint regression.

## Failure modes
- Adding a feature with duplicate feature_key → 409 CONFLICT.
- Setting quota_value on a non-quota-type feature → ignored (controller sanitizes).
- Deleting a feature with active tier_features rows → cascade deletes the mappings (acceptable; admin should soft-delete via active=false instead).
- Brand on a tier whose tier_features row is missing for a feature → effective lookup falls through to features.default_quota and included=false.
