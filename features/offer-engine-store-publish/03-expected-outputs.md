# Expected Outputs — offer-engine-store-publish (D Phase 1, backend)

## Files created
- `backend/migrations/085_offer_store_direct.sql` — additive `follower_transactions.brand_offer_id` + `offer_source` + partial index.
- `backend/scripts/run-085.js` — prod runner.
- `backend/tests/offer-store-publish.test.js` — publish persists, store surfacing, exclusion, schema columns.

## Files changed
- `backend/src/controllers/brandOffer.controller.js` — `updateOffer` accepts `published_to_store` / `store_starts_at` / `store_ends_at`.
- `backend/src/services/follower.service.js` — `resolveBusinessStore` adds the `store_offers` array (additive; existing output unchanged).

## Data behaviour (verifiable)
- `PATCH …/offers/:id` persists publish fields; `GET /business/:id/store` returns `store_offers` for published+active offers; unpublished excluded.
- `follower_transactions` has the two new columns (default `offer_source='influencer'`).

## QA / proof of done
- `offer-store-publish.test.js` 4/4 GREEN on real DB.
- `follower-store.test.js` regression: failures NOT increased by this change (8 with vs 9 without — pre-existing tier-seed harness debt + truncate-flake ±1; my edit adds no failures).

## Release classification
**PRODUCTION-IMPACTING (migration 085 + backend/src) but DORMANT** — `store_offers` unread by current mobile; new columns unwritten until D2. Backend-only → Render + prod migration. Explicit go before deploy.
