# Expected outputs — Vertical feature-gating

## API (brand-side)
| Caller category | Route | Before | After |
|---|---|---|---|
| restaurant | `GET /meals/config` | 200 | 200 (unchanged) |
| car_rental | `GET /meals/config` | 200 (leak) | **403 FORBIDDEN** |
| fashion    | `PUT /meals/config` | 200 (leak) | **403 FORBIDDEN** |
| restaurant | `GET /brands/me/bookings` | 200 | 200 (unchanged) |
| car_rental | `GET /brands/me/bookings` | 200 | 200 (booking=true) |
| fashion    | `GET /brands/me/bookings` | 200 (leak) | **403 FORBIDDEN** |

403 envelope: `{ success:false, error:{ code:'FORBIDDEN',
message:'This feature is not available for your business type.' } }`.

## Nav (brand-web)
| Category | Meals tab | Bookings tab |
|---|---|---|
| restaurant | shown | shown |
| car_rental | hidden | shown |
| fashion    | hidden | hidden |
| (schema not yet loaded) | hidden | hidden |

## Invariants / regression
- Universal nav items (Dashboard, Campaigns, Contracts, Influencers,
  Listings, Gallery, Proposals, Conversions, Wallet, Settings) unchanged
  for all verticals.
- `pnpm qa` stays green; zero regression on existing restaurant Meals/
  Bookings flows.
- Schema cache-bust behaviour in `getListingConfig` preserved
  (`clearSchemaCache()` now lives in the service).
