# Expected Outputs — billing-brand-feature-overrides (A14)

## Database (after M069)

New table `brand_feature_overrides`:
```
brand_id       uuid    NOT NULL  REFERENCES brands(id)   ON DELETE CASCADE
feature_id     uuid    NOT NULL  REFERENCES features(id) ON DELETE CASCADE
included       boolean NOT NULL
quota_value    numeric(10,2)
config         jsonb   NOT NULL DEFAULT '{}'::jsonb
notes          text
created_at     timestamptz NOT NULL DEFAULT now()
updated_at     timestamptz NOT NULL DEFAULT now()
updated_by     uuid    REFERENCES users(id)
PRIMARY KEY    (brand_id, feature_id)
```

Index: `(brand_id)` for typical lookup pattern.
Trigger: `update_updated_at` on UPDATE.

## API JSON shapes

**`GET /v1/admin/brands/:id/overrides` →**
```json
{
  "success": true,
  "data": {
    "brand_id": "<uuid>",
    "tier_id":  "<uuid>",
    "tier_key": "free",
    "features": [
      {
        "feature_key": "bulk_outreach",
        "label": "Bulk influencer outreach",
        "category": "influencer",
        "feature_type": "boolean",
        "unit": null,
        "description": "Send invitations to many influencers in one action",
        "is_enforced": true,
        "tier_default": {
          "included": false,
          "quota_value": null,
          "config": {}
        },
        "override": null
      },
      {
        "feature_key": "active_campaigns",
        "label": "Active campaigns",
        "category": "campaigns",
        "feature_type": "quota",
        "unit": "count",
        "description": "Max simultaneously active campaigns",
        "is_enforced": true,
        "tier_default": {
          "included": true,
          "quota_value": 1,
          "config": {}
        },
        "override": {
          "included": true,
          "quota_value": 10,
          "config": {},
          "notes": "Promo grant"
        }
      }
    ]
  }
}
```

**`PUT /v1/admin/brands/:id/overrides` →**
Request:
```json
{ "items": [
    { "feature_key": "bulk_outreach", "override": { "included": true, "quota_value": null, "config": {}, "notes": "Promo grant" } },
    { "feature_key": "active_campaigns", "override": null }
] }
```
Response:
```json
{ "success": true, "data": { "upserted": 1, "deleted": 1 } }
```

**`GET /v1/brands/me/quota-preflight` (existing)** — unchanged shape,
but the values now reflect overrides where applicable. Behaviour-inert
when no overrides exist.

## Test results
- pnpm qa main lane GREEN unchanged (no public-facing API shape
  change; new admin endpoints aren't exercised by the existing
  Playwright suite).
- M069 applied to local dev; sanity probe confirms table exists with
  expected columns.
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING: Render redeploys backend (new table read +
new admin endpoints); Vercel redeploys brand-web (new admin card).
M069 needs separate explicit founder go to apply on Supabase prod.
Empty table = identical entitlements behaviour to today.
