# billing-brand-feature-overrides — Phase A14

> Deferred from A10 ("do it in A14"). Adds a per-brand override layer
> on top of the existing tier_features defaults so admins can grant
> (or restrict) a specific brand's entitlements without changing the
> brand's subscription tier.

## What ships

**Migration M069** — new table `brand_feature_overrides`:
- `(brand_id uuid, feature_id uuid)` composite PK
- `included boolean NOT NULL`
- `quota_value numeric(10,2)` (nullable; only meaningful for quota
  features; -1 = unlimited)
- `config jsonb NOT NULL DEFAULT '{}'::jsonb` (only meaningful for
  config features)
- `notes text`
- `created_at`, `updated_at`, `updated_by`
- FKs cascade-delete on brands or features deletion.
- Indexes: `(brand_id)` (typical lookup pattern).

**Backend — 3rd lookup layer in `entitlements.service.getEntitlements`**

Today the resolution chain is: `brand.active subscription.tier_id` →
`tier_features` row → fall back to `features.default_quota` /
`included=false`. A14 inserts a third source:

```
catalog                    → tier_features                → brand_feature_overrides
(all features, type/etc.)    (tier default per feature)     (per-brand override)
```

**Semantics (full replacement, not field-level merge):** if a
`brand_feature_overrides` row exists for `(brand_id, feature_id)`,
the entire row (included/quota_value/config) supersedes the
tier_features row. Absence of an override row = tier default. To
revert a brand to tier defaults for a feature, the admin deletes
the override row (the bulk PUT below handles this implicitly).

This is symmetric with how `tier_features` overrides catalog
defaults: presence of a tier_features row = tier value, absence
= catalog default.

**Backend — admin endpoints (requireAnyAdminRole)**

- `GET /v1/admin/brands/:id/overrides`
  Returns the full feature catalog joined with this brand's tier
  defaults + this brand's override rows. Shape per feature:
  ```json
  {
    "feature_key": "bulk_outreach",
    "label": "Bulk influencer outreach",
    "category": "influencer",
    "feature_type": "boolean",
    "unit": null,
    "description": "...",
    "is_enforced": true,
    "tier_default": { "included": true, "quota_value": null, "config": {} },
    "override":     null  // or { "included", "quota_value", "config", "notes" }
  }
  ```
  Plus a top-level `tier_key` for context.

- `PUT /v1/admin/brands/:id/overrides`
  Bulk upsert/delete. Body shape mirrors `upsertTierFeatures`:
  ```json
  { "items": [
      { "feature_key": "bulk_outreach", "override": { "included": true, "quota_value": null, "config": {}, "notes": "Free brand promo" } },
      { "feature_key": "active_campaigns", "override": null }
  ]}
  ```
  For each item: `override` non-null → UPSERT the override row;
  `override` null → DELETE the override row (revert to tier default).
  Single transaction. Busts the entitlements catalog cache so the
  brand sees the new entitlements within the next request after
  60s TTL (or instantly via the bust).

**Frontend — admin brand detail page**

Append a third card to `/admin/brands/[id]` (after the existing
profile card + platform fee override card): **"Feature Overrides"**.

Card layout:
- Section grouped by category (influencer / campaigns / products /
  brand_store / support), matching the tier editor Section C.
- Per feature row:
  - Label + feature_key + feature_type badge + description.
  - "Use tier default" checkbox (default ON when no override exists).
  - When ON: row reads-only, shows the tier value (greyed).
  - When OFF: per-type editor (boolean checkbox / quota number /
    config inputs for discover_filter + open_group_broadcast) plus
    a notes field. Same UI primitives as the tier editor.
  - ENFORCED badge if catalog row has `is_enforced=true`.
- Single Save button at the bottom (bulk PUT).
- Effective tier shown at the top of the card ("Brand is on Pro").

This matches the founder's intent of "admin can override per-brand
entitlements from the brand detail page" without proliferating new
routes.

## Verify-twice

- `entitlements.service.getEntitlements` shape and the existing
  60s in-memory catalog cache (`_catalogCache`) confirmed.
- Admin brand detail page at `Packages/brand-web/app/admin/brands/[id]/page.js`
  exists (137 lines) and already exposes a per-brand override pattern
  (platform fee).
- Tier editor at `Packages/brand-web/app/admin/pricing/tiers/[tier_key]/page.js`
  (260 lines) is the reference for Section C feature/quota/config UI
  primitives.
- adminApi already exposes `listFeatures`, `listTierFeatures`,
  `upsertTierFeatures` — A14 adds the brand-scoped equivalents.

## Out of scope

- Brand-facing UI changes (entitlements still show on the
  Subscription page sourced from `listTiers`; overrides only affect
  what the brand can DO at runtime, not what the catalog says).
- Audit log / history of override changes (would need a separate
  audit table; deferred).
- Per-feature override expiry (effective_until timestamp). Deferred.
- Bulk admin operations across many brands. Deferred (per-brand only
  for now).

## Files
- `backend/migrations/069_brand_feature_overrides.sql` +
  `backend/scripts/run-069.js`.
- `backend/src/services/entitlements.service.js` — 3rd lookup layer.
- `backend/src/controllers/features.controller.js` — new
  `brandOverrides` list + bulk-upsert handlers. Or extracted to a
  small dedicated module (TBD during impl — whichever keeps the
  diff cleaner).
- `backend/src/routes/admin.routes.js` — new route mounts.
- `Packages/brand-web/lib/api.js` — `listBrandOverrides`,
  `upsertBrandOverrides` additions to `adminApi`.
- `Packages/brand-web/app/admin/brands/[id]/page.js` — Feature
  Overrides card appended (replicates Section C from the tier
  editor with the override toggle).
- This contract.

## Non-functional
- Deploy posture: PRODUCTION-IMPACTING — Render redeploys backend
  (new table read + new endpoints); Vercel redeploys brand-web (new
  admin card). M069 needs separate explicit founder go to apply on
  Supabase prod.
- Behaviour-inert until admin actually saves an override — empty
  table = identical entitlements to today.
- Backward compatible at every layer: entitlements.service falls
  through to tier_features when no override row exists.
- API JSON shape unchanged for brand-facing endpoints; new
  endpoints under `/admin/brands/:id/overrides` only.
