# Expected Outputs — wave1-tax-config-foundation

## Database (after M072 + M073 + M074)

### payment_config (singleton row id=1)
New columns:
- `gst_pct` = 18.00
- `tcs_pct` = 1.00
- `tcs_active` = false
- `tcs_active_from_date` = NULL
- `platform_gstin`, `platform_business_name`, `platform_business_address`,
  `platform_state_code` = NULL (admin fills in via UI)
- `invoice_prefix_subscription` = 'INF-SUB'
- `invoice_prefix_commerce` = 'INF-COM'
- `tranche_3_release_time_ist` = '03:00:00'

### categories
- `return_window_days` = 30 on all 16 seed rows (replaces the global
  fallback for the per-category window).

### influencers
- `tds_override_pct` = NULL on all rows (admin opts-in per-influencer).
- `tds_exempt` = false on all rows.

### brands
- `commerce_commission_override_pct` = NULL on all rows.

## API JSON shapes

Unchanged in this commit. The follow-up admin-UI commit will surface
these fields on the relevant endpoints (`GET /admin/payment-config`,
`GET /admin/brands/:id`, `GET /admin/influencers/:id`,
`GET /admin/categories`).

## Service behaviour

`paymentConfig.getConfig()` cache now includes:
```js
{
  // existing fields...
  gstPct: 18.00, tcsPct: 1.00, tcsActive: false, tcsActiveFromDate: null,
  platformGstin: null, platformBusinessName: null,
  platformBusinessAddress: null, platformStateCode: null,
  invoicePrefixSubscription: 'INF-SUB', invoicePrefixCommerce: 'INF-COM',
  tranche3ReleaseTimeIst: '03:00:00',
}
```

`tax.service` (new) exposes:
- `gstOn(amount) → number` — amount * pct/100, 2dp
- `withTax(base) → { base, gst, total }`
- `tcsOn(brandPortion[, asOf]) → number` — 0 unless active
- `getTcsConfig() → { pct, active, activeFrom }`
- `getInvoiceIdentity() → { gstin, businessName, address, stateCode, prefixSub, prefixCom }`
- `getTrancheReleaseTimeIst() → string 'HH:MM:SS'`

## Test results

- pnpm qa main lane GREEN.
- Backend boot smoke clean.
- M072/M073/M074 applied to local dev DB; sanity probes confirm new
  columns exist with default values.

## Deploy posture

PRODUCTION-IMPACTING (Render redeploys backend with the centralized
tax-config reads). 3 prod migrations (M072 + M073 + M074) need
founder explicit go after push — bundled apply via trap+restore.
