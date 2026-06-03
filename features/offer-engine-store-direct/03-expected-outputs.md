# Expected Outputs — offer-engine-store-direct (Sub-contract D2)

## Files changed
- `backend/src/controllers/transaction.controller.js`:
  - `fetchStoreOfferOrThrow(brandOfferId, brandId)` — validates published/active/
    in-window + brand ownership.
  - `initiateStoreOfferPay` / `verifyStoreOfferPay` — the store-direct pay+verify
    (commission 0, path direct, null tracking IDs, `offer_source='store'`).
  - exported both.
- `backend/src/routes/transaction.routes.js`: `POST /store-offer/pay` +
  `/store-offer/verify` (follower-auth).

## Files created
- `backend/tests/offer-store-direct.test.js` — happy path + guards.

## No migration / no UI
- Uses migration 085 columns (D1). Backend-only.

## Behaviour (verifiable)
- pay→verify writes a `follower_transactions` row: all tracking IDs NULL,
  `brand_offer_id` set, `offer_source='store'`, `influencer_commission=0`,
  discount applied, brand settled.
- unpublished/cross-brand → 409; bad input → 422.

## QA / proof of done
- `offer-store-direct.test.js` 4/4 GREEN on real DB.
- `pay-at-store.test.js` regression: 10F/1P **identical** with vs without this
  change (git-stash baseline) — failures are pre-existing tier-seed/campaign-chain
  harness debt, not introduced here. Additive functions + routes; existing flows
  untouched.

## Release classification
**PRODUCTION-IMPACTING (`backend/src`) but DORMANT** — new endpoints, no caller
until D3. Backend-only → Render, no migration/OTA/web. Explicit go before deploy.
