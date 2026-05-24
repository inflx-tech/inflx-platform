# Expected Outputs — billing-tier-features-and-settings (Phase A9)

## DB
- `subscription_tiers.features_json` (jsonb) exists.
- 4 tier rows each have `jsonb_array_length(features_json) = 5` after M060.

## API
- `GET /v1/subscription-tiers` → response includes `features_json: string[]` per tier.
- `GET /v1/brands/me/subscription` → `data.tier.features_json: string[]`.
- `GET /v1/admin/subscription-tiers` → includes `features_json`.
- `PATCH /v1/admin/subscription-tiers/:tierKey` accepts `{ features_json: ["...", "..."] }`. Rejects non-array, empty strings, strings > 200 chars with `422 VALIDATION_ERROR`.

## Frontend routes
- `/dashboard/settings/profile` → profile editor (moved).
- `/dashboard/settings/subscription` → subscription page with new features bullets.
- `/dashboard/settings/billing` → billing page.
- `/dashboard/profile` → 308 redirect to `/dashboard/settings/profile`.
- `/dashboard/subscription` → 308 redirect to `/dashboard/settings/subscription`.
- `/dashboard/billing` → 308 redirect to `/dashboard/settings/billing`.

## Nav
- 12 items (down from 14): Dashboard, Campaigns, Contracts, Influencers, Listings, Meals, Bookings, Gallery, Proposals, Conversions, Wallet, Settings.

## Quota wall visible behaviour
- Brand on Free with 10 products tries to create #11 → modal renders with "FREE plan's products limit" + used 10 / limit 10 + upgrade_to chips + "View plans" button → click → `/dashboard/settings/subscription`.

## Tests (pnpm qa)
- 75/75 GREEN, STATE=GREEN, gate=0.
- 2 new redirect tests + 2 updated content tests in `subscription-billing-nav.spec.ts`.

## Deploy posture
PRODUCTION-IMPACTING. Migration runs atomically with the new Render image (backend reads `features_json` immediately). Vercel deploys the new layout + moved pages + redirect stubs. Mobile untouched; OTA skipped.
