# Before / After — brand mobile offer builders (A7)

**Before:** the mobile Offer library could create only **discount** offers (pct / flat).
Its empty state and builder sheet both said *"build volume/BOGO/bundle offers on the web
dashboard"* — a real capability gap under the locked scope rule (only campaign creation and
listing are web-only).

**After:** the builder has an **offer-type selector — Discount · Volume · BOGO · Bundle** —
with per-type forms:
- **Volume:** tier basis (₹ spend or quantity) + repeatable tiers (threshold → % off).
- **BOGO:** product picker + buy qty / free qty.
- **Bundle:** multi-select 2+ products + bundle price.
The new `ProductPickerSheet` (over the existing `brandApi.listProducts()`) is the piece that
previously made BOGO/bundle impossible on the phone. All "go to the web dashboard" copy for
these types is gone.

## Correctness
`utils/offerBuilders.js` produces exactly the `offer_config_json` shapes the backend
`services/offerConfig.validator.js` requires — verified by reading the validator, not
guessed: volume → `tiers[{min_spend|min_qty, pct_off}]` + `mode`; bogo → `{product:{id},
buy_qty, free_qty}`; bundle → `{products:[{id}…], bundle_price}` with ≥2 products. Client
validation mirrors the server rules (positive thresholds, pct ≤ 100, ≥2 bundle products).

## Changed
- New `utils/offerBuilders.js` (10 unit tests) + `components/brand/ProductPickerSheet.js`.
- `BrandOffersLibraryScreen` — type selector, per-type forms, picker wiring, reset, copy.

## Verification
- **Mobile jest 103/103 green** (22 suites): 10 offer-builder specs + 2 smoke + 91 prior.
- Verified in the founder's single E2E pass.

## Known delta / deferred
- **free_gift** builder not included (needs main+gift pairs; still web).
- Offer **scope** stays `store` for discount/volume (category/product scoping stays web).
- Changing an existing offer's type is impossible **by backend design** (`offer_type` is
  immutable) — create a new offer instead.
