# Expected outputs

- Journey driver S6.6a: publish library offer to store → appears in
  /follower/section/offers feed → GET /follower/store-offer/:id → 200 with
  { offer (discount.label, config), brand, products[] }.
- S6.6b: assignment item tap path — GET /store/:handle/products?ci_id → 200.
- S6.6c: library id sent as offer_id still 404s (legacy branch unchanged).
- Unknown/archived store-offer id → 404 'Offer not found or no longer active'.
- OfferBlock receives discount + config from the nav payload immediately
  (no fetch wait) on feed taps; enriched from the endpoint on store taps.
- Transact screens receive long-form tracking; payAtStore from a conversion
  tap writes follower_transactions with all 4 IDs (S6.3 stays green).
- pnpm qa 79/79 GREEN; full journey 30/30 PASS.
