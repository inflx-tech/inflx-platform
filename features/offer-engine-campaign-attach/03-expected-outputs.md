# Expected Outputs — offer-engine-campaign-attach (Sub-contract C, backend)

## Files changed
- `backend/src/controllers/campaign.controller.js`:
  - new helper `resolveOfferAttachment({ brandId, goal, brand_offer_id, offer_type, offer_config_json })`
    → `{ effType, effConfig, brandOfferId, allocation }` (fetches + verifies the
    library row, snapshots, derives allocation from goal).
  - `invite`: accept `brand_offer_id`; relax engagement validation (offer allowed;
    coupon/commission still forbidden); write `brand_offer_id` + `allocation` +
    snapshotted `offer_type`/`offer_config_json`.
  - `updateInfluencer`: capture set goal; accept `brand_offer_id`; same snapshot +
    allocation; write the two columns.

## Files created
- `backend/tests/offer-attach.test.js` — the `02-workflow.md` assertions
  (attach conversion/engagement, cross-brand 404, archived 422, engagement+
  commission 422, inline regression ×2, updateInfluencer attach).

## No migration / no UI
- Columns already exist (`084`). No frontend in this contract.

## Data behaviour (verifiable)
- CI rows attached from a library offer carry `brand_offer_id`, `allocation`, and
  a byte-snapshot of the library `offer_type`/`offer_config_json`.
- Engagement attach → `allocation='promotional'`, no coupon/commission.
- Inline + no-offer paths unchanged (allocation stamped, dormant).

## QA / proof of done
- `offer-attach.test.js` GREEN on a real DB.
- Existing `campaigns.test.js` (invite/offer suites) GREEN — zero regression.
- `pnpm qa` lane unaffected by behaviour (only additive paths + dormant metadata).

## Release classification
**PRODUCTION-IMPACTING (`backend/src`) but DORMANT** — the engagement relaxation
is unreachable until the sibling wizard UI sends offers for engagement; existing
requests are identical. Backend-only → Render redeploy, no migration/OTA/web.
Explicit founder go before push.
