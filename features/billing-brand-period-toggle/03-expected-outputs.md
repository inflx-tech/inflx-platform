# Expected Outputs — billing-brand-period-toggle (A11)

## API
- `GET /v1/subscription-tiers` — each tier now carries `prices: [...]` + `entitlements: [...]` arrays in addition to legacy fields.
- `POST /v1/brands/me/subscription/upgrade {tier_key, billing_period?}` — accepts optional `billing_period`. Returns `billing_period` in success payload.

## UI
- `/dashboard/settings/subscription`:
  - Period toggle (Monthly | Yearly) visible above the 4-tier grid.
  - Tier cards group features by category (Influencer / Campaigns / Products / Brand store / Support).
  - Config-type features render with their meta (Discover filter: "State, 10 niches"; Open-group: "City, up to 25 recipients").
  - "Save N% vs monthly" callout when yearly price is below 12 × monthly.
  - Error banner for any non-success API response.

## Test results
- pnpm qa 76/76 GREEN expected (no specs changed; existing brand subscription spec still passes).

## Deploy posture
PRODUCTION-IMPACTING: Vercel + Render redeploy. No migration. No mobile.
