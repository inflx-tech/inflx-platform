# Impact — Sprint 3 cart rebuild

**Chat verdict (terse):** fixes a fully-broken flow + adds an organic
order path. Net new capability, zero regression to working flows — the
creator-mediated order has never actually succeeded, so there is no
working behaviour to disturb; the organic path is additive and mirrors
the already-shipped `store-offer/pay` organic code.

## Surface area
- **Backend** `transaction.controller.js` — `placeOrder` gains an organic
  branch; `verifyOrder` null-CI guards. No migration (columns already
  nullable; `store-offer/pay` already writes NULL-attribution rows).
  Production-impacting (Render) → explicit go before deploy.
- **Mobile** `OnlineOrderScreen.js`, `ProductDetailScreen.js` — OTA.
  UI-governed → mockup-lock + 06-diff required.

## Risk
- **Low.** The organic fee/attribution math is a copy of a verified,
  in-prod path. The payload fix is strictly corrective (current code 422s
  100% of the time). Variant pricing reuses existing
  `fetchVariantPriceMap`.
- **Money correctness:** organic = commission 0, brand-direct L3 fee only;
  all rupees; no `*100`/`/100` introduced. `follower_transactions`
  attribution columns NULL for organic (store-beats-window logic
  unaffected — it keys on `via_store_influencer_id`, never set here).

## Backout
- Revert the two commits; OTA the prior bundle. No schema/data migration
  to unwind.
