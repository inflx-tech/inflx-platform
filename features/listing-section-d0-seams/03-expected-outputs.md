# Expected Outputs — D0: Unify the listing↔section seams

Concrete, checkable end states. "It compiled" is not success (GOVERNANCE §2).

## Code artifacts
- `backend/src/services/taxonomy.service.js` exists, exports
  `getNavVerticals()`, `schemaKeysFor(superCategory)`, `superCategoryOf(schemaKey)`,
  `clearTaxonomyCache()`.
- `backend/src/services/brandOffers.adapter.js` exists, exports a single
  `getOffersForScope(scope)` (or equivalent) returning the normalized offer shape.
- `CATEGORY_MAP` no longer present in `follower.service.js` or `sectionRules.service.js`
  (grep returns 0 hits outside the new service/fallback).
- `VALID_AVAILING_MODES` = `['pay_at_store','prebook','online_order','book','enquiry','showcase']`,
  exported from one module and imported by validator + (future) CTA/section consumers.

## Behavioural assertions (tests)
- **Taxonomy faithfulness:** for each of the 7 tiles, `schemaKeysFor(tile)` equals the
  intended canonical set (§1 map in COMBINED-IMPLEMENTATION-PLAN.md). Explicit cases:
  - `schemaKeysFor('eat')` ⊇ `['restaurant','bakery','grocery','packaged_food']`
  - `schemaKeysFor('shop')` ⊇ `['fashion_walkin','fashion_online','electronics','jewellery','footwear','furniture']`
  - `superCategoryOf('salon') === 'groom'` (the beauty→groom rename)
  - `superCategoryOf('florist') === 'events'` (the corrected placement)
  - `getNavVerticals()` returns exactly 7 tiles in stable order.
- **Feed-unchanged (regression):** a snapshot of `/section/category/:key` (e.g. an `eat`
  vertical with restaurant data) returns the same brand/offer IDs before and after.
- **Offer adapter (flag OFF):** `/section/offers` returns the same offer set as the
  pre-change `campaign_offers` path; normalized shape includes `availing_modes` + 4-ID
  tracking; store-direct rows (if any) carry `iid=null`.
- **Vocab:** validating an offer with `availing_modes:['book']` and `['showcase']`
  passes; an unknown mode still fails; an existing 4-mode offer still validates.
- **Resilience:** stubbing a missing schema file does not 500 the feed (fallback map).

## QA / gate
- `pnpm qa` GREEN (full), with the new `section-engine`/`admin-sections` assertions
  passing; no suite skipped/weakened (no-fake-green).
- C1 verdict GREEN; gov-check passes (backend-only → Rule 1 + Rule 2 only; no
  mockup-lock/06-diff required).
- `pnpm qa:db` informational; classify any failure, never block on it.

## Release evidence (filled at Step-14)
- `lock.json release` block populated; classification = **production-impacting**
  (backend/src), additive, zero intended follower delta; explicit founder go before
  push/Render deploy.
