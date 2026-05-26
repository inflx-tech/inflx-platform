# 06-diff — billing-brand-feature-overrides (A14)

**Before:** a brand's entitlements were fully determined by their
subscription tier. The chain was:

```
brand → active subscription → tier_id → tier_features → effective entitlements
```

If admin wanted to grant a Free brand `bulk_outreach` (e.g. as a
promotional credit) the only options were:
1. Move the brand to Growth/Pro/Enterprise (changes their billing).
2. Flip the Free tier's `bulk_outreach.included = true` (changes it
   for ALL Free brands).

Neither was a good fit for per-brand exceptions.

**After (A14):** a new layer sits above tier defaults:

```
catalog                  → tier_features                 → brand_feature_overrides
(11 features, types/etc.)  (default per tier × feature)    (per-brand override)
```

`entitlements.service.getEntitlements` now does one additional
SELECT per call (joined with the existing catalog query) and, for
any (brand_id, feature_id) pair that has an override row, the
entitlement comes from the override row instead of the
tier_features row.

**Semantics (chosen):** override row presence = entitlement comes
from override (full replacement). Override row absence = entitlement
comes from the tier_features row. No field-level merging — to revert
a brand to tier defaults for a single feature, the admin deletes the
override row (the bulk PUT handles this implicitly when the admin
ticks "Use tier default" on a row and saves).

**Why full replacement vs field-level merge:**
- Mental model matches how tier_features overrides catalog defaults
  (presence = tier value).
- No need for "did the admin mean to override the quota or just the
  notes?" UI ambiguity.
- Simpler implementation, simpler revert flow.

**Admin UI** — single new card on `/admin/brands/[id]` titled
"Feature Overrides":

| Element | Behaviour |
|---------|-----------|
| Card header | "Brand is on <tier_key>" — context label |
| Per category section | influencer / campaigns / products / brand_store / support — same grouping as the tier editor Section C |
| Per feature row | label + key + type + description + ENFORCED badge if applicable |
| "Use tier default" checkbox | ON (default) = no override, row reads-only with greyed tier value. OFF = row's editor opens with current override values pre-filled (or tier defaults if no override exists) |
| Per-type editor | matches the tier editor Section C primitives — boolean checkbox / quota number / config inputs for discover_filter + open_group_broadcast |
| Notes field | per-override free-text (visible in the brand_feature_overrides.notes column, surfaced in future audit views) |
| Single Save button | bulk PUT — sends override rows for unchecked features; nulls (= delete the row) for re-checked features |

**Error envelope** — admin endpoints follow the standard pattern:

```json
{ "code": "VALIDATION_ERROR",
  "message": "Unknown feature_key: <key>",
  "field": "items[2].feature_key" }
```

**Defensive behaviour:**
- Empty `brand_feature_overrides` table → identical to pre-A14
  (every brand's entitlements come from tier_features as before).
- Pre-M069 deploy → backend boots clean (entitlements.service does
  a LEFT JOIN; missing table would crash, so this contract REQUIRES
  M069 to apply before code reaches prod — handled by the standard
  trap+restore sequence).
- Entitlements cache (60s TTL) busted on every override write so
  admin sees the effect within the next entitlements read.

**Verified locally:** M069 applied to dev DB; sanity probe shows the
table + indexes + trigger; backend boots clean; pnpm qa main lane
unaffected.
