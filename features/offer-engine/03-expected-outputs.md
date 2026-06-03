# Expected Outputs — offer-engine Sub-contract A

> Step 4. The concrete artifacts this contract produces, so "done" is checkable.

## Files created
- `backend/migrations/084_offer_engine.sql` — `brand_offers` table + additive
  columns on `campaign_influencers` (`brand_offer_id`, `allocation`) + store
  columns on `brand_offers` (`published_to_store`, `store_starts_at`,
  `store_ends_at`). `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`,
  idempotent.
- `backend/scripts/run-084.js` — prod runner for migration 084 (per the
  per-migration runner precedent run-0XX.js).
- `backend/src/services/offerConfig.validator.js` — the single shared validator:
  `validateOfferConfig({ offerType, offerConfig, brandId, db }) → { ok, field?, message? }`.
- `backend/src/controllers/brandOffer.controller.js` — list/create/get/update/archive.
- `backend/src/routes/brandOffer.routes.js` — `/brands/me/offers` routes,
  `requireBrand`, mounted in `app.js`.
- `backend/__tests__/brandOffer.*.test.js` (or repo's jest convention) — the
  workflow assertions from `02-workflow.md`.

## Files changed
- `backend/src/routes/index.js` — mount `brandOffer.routes` under `/brands/me`
  (same mount point as `productVariants.routes`).
- `backend/tests/helpers/db.js` — add `brand_offers` to the `truncateAll` list
  (test-harness only; deploy-inert).
- **NOT changed in A:** `backend/src/controllers/campaign.controller.js` is left
  untouched. Its legacy validator uses a *different* offer-type vocabulary
  (`flat/percentage/bogo/bundle/volume/prebook`) and HTTP 422; routing it through
  the new validator would change behaviour. The new validator is **library-only**
  in A; bridging the two vocabularies is deferred to Sub-contract C.
- **NOT changed:** `backend/scripts/migrate.js` — the test DB is built by
  `tests/setup.js` (drops schema, re-runs every `migrations/*.sql` in sorted
  order), so `084` is applied automatically; prod is applied by `run-084.js`.
  The hardcoded list in `migrate.js` is stale at `013` and not on either path.

## Data-model deltas (verifiable in DB)
- `\d brand_offers` shows all columns + the `idx_brand_offers_brand` index.
- `\d campaign_influencers` shows `brand_offer_id` (FK, nullable) + `allocation`
  (nullable, checked).
- Every pre-existing `campaign_influencers` row: `brand_offer_id IS NULL`,
  `allocation IS NULL`.

## API behaviour (verifiable via tests)
- The 5 endpoints behave per `02-workflow.md` steps 1–8.
- `offer_config_json` round-trips byte-for-byte for all 5 types.
- Validation rejections return `400 VALIDATION_ERROR` + `field`; cross-brand
  read returns `404`.

## QA / proof of done
- `pnpm qa` GREEN, C1 gate satisfied, **zero regression** vs baseline (the new
  columns are unread by existing code; `resolveOfferDiscount` output unchanged).
- New jest suite for `brandOffer` + `offerConfig.validator` all green on a fresh
  DB.
- `pnpm qa:db` (informational lane) unaffected.

## Release classification
**PRODUCTION-IMPACTING but DORMANT.** Migration 084 + CRUD service ship live;
empty table + no caller wiring ⇒ no existing flow changes. Explicit founder go
required before prod migrate + push (per the production-impacting carve-out).
