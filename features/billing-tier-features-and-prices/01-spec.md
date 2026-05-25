# billing-tier-features-and-prices — Phase A10 (data model + admin UX)

> **Phase A10 of the INFLX 3-Layer Revenue Model rollout — the
> subscription system rebuild.** Replaces the implicit "tier-row-has-quota-columns"
> model with first-class feature catalog + entitlement mapping +
> separate price-per-cadence rows. Founder-locked 2026-05-25 after
> Heepsy-aside requirements review.

## What ships

- **3 new tables** — `features` (catalog), `tier_features` (entitlement
  mapping), `subscription_prices` (per-period pricing).
- **1 change** to `brand_subscriptions` — new column
  `subscription_price_id` + backfill of existing rows.
- **3 new enums** — `feature_type`, `feature_category`, `billing_period`.
- **13 catalog rows** seeded — 5 Influencer / 2 Campaigns / 2 Products
  / 1 Brand-store / 3 Support (1 baseline + 2 controlled).
- **52 default tier-feature mapping rows** seeded — 4 tiers × 13 features
  with founder-confirmed defaults.
- **4 subscription_price rows** seeded — one monthly per tier from M060
  prices. Yearly rows NOT seeded (admin adds via UI).
- **Entitlements service** — backend function `getEntitlements(brandId)`
  returns the layered effective entitlements.
- **8 new backend endpoints** — features CRUD, tier_features upsert,
  subscription_prices CRUD.
- **2 new admin pages** — features catalog manager + rebuilt 3-section
  tier editor.
- **Tests** — features.test.js + entitlements coverage.

## What does NOT ship in A10

- **Per-brand override** (`brand_feature_overrides` table) — deferred
  to A14 per founder decision 2026-05-25.
- **Brand-side period toggle + entitlement rendering** — A11 (next phase).
- **Per-feature gate wiring** (the `requireFeature` middleware applied
  to real endpoints) — A12, founder-paced per feature in catalog
  sequence.
- **Yearly Razorpay billing** — A13 alongside A6.5 live-mode work.

## The feature catalog (13 rows, founder-locked 2026-05-25)

| # | feature_key | category | type | default_quota | notes |
|---|---|---|---|---|---|
| 1 | discover_filter | influencer | config | — | Niches + area scope per tier |
| 2 | search_filters_advanced | influencer | boolean | — | |
| 3 | bulk_outreach | influencer | boolean | — | |
| 4 | invitations_per_cycle | influencer | quota | 5 | |
| 5 | open_group_broadcast | influencer | config | — | Area scope + max recipients |
| 6 | active_campaigns | campaigns | quota | 1 | |
| 7 | sets_per_campaign | campaigns | quota | 1 | |
| 8 | products_in_store | products | quota | 10 | |
| 9 | media_gallery_items | products | quota | 20 | |
| 10 | multi_branch_support | brand_store | boolean | — | |
| 11 | self_serve_onboarding | support | baseline | — | Everyone gets it |
| 12 | dedicated_onboarding_call | support | boolean | — | |
| 13 | phone_support_24x7 | support | boolean | — | |

## Default tier × feature mapping (52 seed rows)

Free: discover (city, 3 niches), invitations 5, campaigns 1, sets 1,
products 10, gallery 20, self-serve onboarding only.

Growth: + advanced search, + bulk outreach, + open-group (city, 25
recipients), invitations 25, campaigns 3, sets 3, products 100,
gallery 200.

Pro: open-group (state, 100), invitations 100, campaigns 10, sets 10,
products 500, gallery 1000, + multi-branch, + dedicated onboarding call.

Enterprise: open-group (all-India, unlimited), invitations unlimited
(-1), campaigns unlimited, sets unlimited, products unlimited,
gallery unlimited, all support features incl. 24×7 phone.

## Entitlements lookup logic (effective resolution)

`getEntitlements(brandId)` returns a map keyed by `feature_key`:
- Find brand's active subscription → tier_id.
- Join tier_features for that tier_id with the features catalog.
- For each row: `{ included, quota_value, config, feature_type, is_enforced }`.
- Cached per-request.

In A10 the lookup goes: tier_features → catalog default. In A14 (when
per-brand override lands) the lookup gets a third layer: brand_feature_overrides
→ tier_features → catalog default. The shape of `getEntitlements` does
NOT change — A14 just adds one query layer above it.

## Non-functional

- Idempotent migration (IF NOT EXISTS + DO $$ EXCEPTION + ON CONFLICT).
- Additive only — no existing column dropped. `subscription_tiers.monthly_price_inr`
  + `features_json` columns stay for back-compat (the new code authoritative).
- Money: rupees numeric(10,2). Razorpay paise boundary unchanged.
- Backfill safe: every active brand_subscription points at its monthly price after run.
