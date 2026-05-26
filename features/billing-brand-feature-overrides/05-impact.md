# Impact — billing-brand-feature-overrides (A14)

## Changes
- 1 migration (M069) creates `brand_feature_overrides` table.
- 1 runner script.
- `entitlements.service.getEntitlements`: third lookup layer merges
  per-brand override rows over the tier_features result.
- 2 admin endpoints (`GET` + bulk `PUT`) under
  `/v1/admin/brands/:id/overrides`.
- Admin route mounts.
- `adminApi.listBrandOverrides` + `adminApi.upsertBrandOverrides`
  added to brand-web's API client.
- Feature Overrides card appended to `/admin/brands/[id]` (replicates
  the tier editor Section C with a per-row "Use tier default" toggle).
- 1 contract folder.

## Blast radius
- **`entitlements.service`** — the only behavioural touchpoint at
  runtime. Adds one SELECT against `brand_feature_overrides`
  inside `getEntitlements`. All A12.x gates flow through this
  service and pick up the override transparently.
- **`/admin/brands/[id]`** page gets a new card. No other admin
  page changes.
- **No brand-facing UI change.** The Subscription page sources its
  copy from `listTiers` + per-tier entitlements (not per-brand).
  Brand sees the same plan card; what they can DO at runtime is what
  changes when an override exists.

## Rollback
Revert commit + revert M069 (`DROP TABLE brand_feature_overrides`
or `is_enforced=false` style flip-back if rows have been written).
entitlements.service falls back to tier_features once the table is
gone. The Feature Overrides card returns 404 / empty on rollback —
acceptable.

## Risks
- **Empty table = no behavioural change.** The path is additive at
  every layer.
- **Entitlements cache TTL** is 60s. After admin saves an override,
  the change shows up within 60s naturally (or instantly via the
  cache bust on PUT). Acceptable for an admin-only flow.
- **No audit log of override changes.** Out of scope; carved as
  follow-up.
- **No override expiry / "temporary grant"** support. Out of scope.
- **Per-feature config validation** — the bulk PUT trusts the
  override.config blob shape. For known config features
  (discover_filter, open_group_broadcast) the admin UI enforces the
  shape; arbitrary jsonb is accepted at the backend layer. Tight
  validation deferred (matches the existing tier_features pattern).
- **Cascade delete:** if a brand row is deleted, its overrides go
  too (FK cascade). Same for features.

## Pre-push checklist
1. pnpm qa main lane GREEN.
2. Backend boot smoke clean.
3. M069 applied locally; sanity probe shows the table exists with
   expected columns + indexes + trigger.
4. gov-check exit 0 (Rules 1+3+4).
5. M069 prod run gated on separate explicit founder go after push.
