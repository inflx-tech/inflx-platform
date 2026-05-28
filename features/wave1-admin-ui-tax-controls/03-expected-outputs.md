# Expected Outputs — wave1-admin-ui-tax-controls

## Database
No new migrations.

## API JSON shapes

### `PATCH /admin/brands/:id/commerce-commission-override`

Request: `{ commerce_commission_override_pct: 3.5 }` (or `null` to clear)

Response:
```json
{
  "success": true,
  "data": {
    "brand_id": "uuid",
    "commerce_commission_override_pct": "3.50"
  }
}
```

### `PATCH /admin/influencers/:id/tax-controls`

Request: `{ tds_override_pct: 5.0, tds_exempt: false }`

Response:
```json
{
  "success": true,
  "data": {
    "influencer_id": "uuid",
    "tds_override_pct": "5.00",
    "tds_exempt": false
  }
}
```

### `PATCH /admin/config/payments` (extended via Wave 1 commit 1)

Now accepts (in addition to existing fields):
- `gst_pct`, `tcs_pct`, `tcs_active`, `tcs_active_from_date`
- `platform_gstin`, `platform_business_name`,
  `platform_business_address`, `platform_state_code`
- `invoice_prefix_subscription`, `invoice_prefix_commerce`
- `tranche_3_release_after_days`, `tranche_3_release_time_ist`

### `GET /admin/config/payments` (extended via Wave 1 commit 1)

Returns all of the above on the cfg object (camelCase).

## UI behaviour post-deploy
- /admin/settings/payments shows an extended FIELDS list + a new
  "Tax & Identity" section below.
- /admin/brands/[id] shows an "L3 Commerce Commission Override" card.
- /admin/influencers/[id] shows a TDS Status Field + "TDS Controls"
  card.

## Test results
- pnpm qa main lane 76/76 GREEN (46.0s).
- Backend boot smoke clean.

## Deploy posture
PRODUCTION-IMPACTING (Render redeploys backend with 2 new endpoints;
Vercel redeploys brand-web with 3 admin page extensions + 1 lib
helper). NO migration.
