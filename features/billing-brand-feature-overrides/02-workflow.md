# Workflow — billing-brand-feature-overrides (A14)

## Actor
Admin (any admin role) on `/admin/brands/[id]` managing per-brand
feature overrides.

## Preconditions
- A10/A12.1–A12.7 shipped (catalog + tier_features + all per-feature
  gates live).
- M069 applied (brand_feature_overrides table exists on Supabase
  prod).

## Workflow A — admin grants a Free brand `bulk_outreach`

1. Admin opens `/admin/brands/<brand_uuid>` and scrolls to the
   **Feature Overrides** card.
2. Page calls `GET /v1/admin/brands/<brand_uuid>/overrides`. Response
   returns the full catalog with `tier_default` from the brand's tier
   (Free) and `override: null` for every row (no overrides yet).
3. Admin finds the `bulk_outreach` row under "Influencer" category.
   Row shows tier default = `included: false`, with a "Use tier
   default" checkbox ON.
4. Admin unchecks "Use tier default" → the row's editor opens. Admin
   ticks the `included` checkbox → row state becomes `included: true,
   notes: ''`.
5. Admin types "Promo grant — Q3 partnership" in the notes field.
6. Admin clicks **Save**.
7. Frontend sends `PUT /v1/admin/brands/<brand_uuid>/overrides` with
   body `{ items: [{feature_key: 'bulk_outreach', override: {
   included: true, quota_value: null, config: {}, notes: 'Promo
   grant — Q3 partnership' }}] }`.
8. Controller upserts the row in `brand_feature_overrides`, busts
   the entitlements catalog cache, returns success.
9. Admin sees the success toast.
10. From this point, the Free brand can publish campaigns with
    open-group sets — the A12.5 gate consults
    `entitlementsService.hasFeature(bulk_outreach)`, which now
    reads the override row → `included=true`.

## Workflow B — admin caps a Pro brand's `active_campaigns` lower

1. Same opening flow. Admin finds `active_campaigns` (quota,
   category "Campaigns").
2. Row shows tier default = `included: true, quota_value: 10` (Pro
   default).
3. Admin unchecks "Use tier default". Editor shows the quota input
   with the current tier value pre-filled.
4. Admin changes the quota to `3`.
5. Save → `PUT` with `override: { included: true, quota_value: 3,
   config: {}, notes: 'temporary cap' }`.
6. The A12.1 quotaCheck middleware now reads `quotaFor(brand,
   active_campaigns) = 3` for that brand.

## Workflow C — admin reverts an override to tier default

1. Admin finds a row that has `override` set (shown with a small
   "Overridden" badge / different background).
2. Admin re-checks "Use tier default" — the editor collapses; row
   shows the tier default value again.
3. Save → `PUT` with `override: null` for that feature_key.
4. Controller `DELETE`s the row from `brand_feature_overrides` in
   the same transaction.
5. Brand's entitlements revert to tier defaults within 60s
   (entitlements cache TTL) or the next request (cache bust).

## Workflow D — admin opens overrides page for a brand with existing
overrides

1. Same opening flow. Backend joins the catalog with
   `brand_feature_overrides` and returns `override: {...}` for the
   matching rows.
2. Frontend renders those rows with the "Use tier default" checkbox
   OFF and the editor populated from the override values.
3. Admin can edit / revert / leave alone any row.

## Workflow E — pre-M069 / table missing

1. If M069 hasn't applied (e.g. before prod migration), the GET
   endpoint returns `override: null` for every row (defensive — the
   LEFT JOIN to `brand_feature_overrides` finds no matches).
2. PUT endpoint can't actually persist (table missing → INSERT
   fails). Behaviour is "everything stays at tier defaults" until
   the migration runs.
3. Once M069 runs, both endpoints work normally.

## Success
- pnpm qa main lane GREEN unchanged.
- Admin can grant / restrict / revert per-feature entitlements per
  brand from the brand detail page.
- Brand entitlements at runtime correctly reflect overrides within
  60s of save.
- Empty overrides table = identical behaviour to pre-A14.
- Backend boot smoke clean.

## Failure modes
- Brand UUID invalid → 404 NOT_FOUND.
- `feature_key` unknown in PUT body → 400 VALIDATION_ERROR with the
  bad key.
- DB transaction failure on PUT → atomic rollback, no partial state.
- Entitlements cache TTL → eventual consistency within 60s if cache
  bust is missed; explicit bust on every PUT keeps it instant.
- Pre-M069: PUT fails (table missing); admin sees the error toast.
