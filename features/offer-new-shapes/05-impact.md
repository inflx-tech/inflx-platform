# Impact — offer-new-shapes

**Verdict: additive new offer shapes; old offers untouched.**

- Backend: validator gains a quantity-volume branch + a same-product-BOGO
  branch; engine (resolveVolume/resolveBogo) gains the matching compute
  branches. Old shapes (spend-volume, buy/get-BOGO) keep their exact behavior —
  selected by config shape, so existing live offers are unaffected.
- brand-web: OfferBuilder gains a Volume mode toggle + BOGO same-product form.
- Mobile: OfferBlock renders the new displays; cart preview needs NO change
  (new shapes flow through the Phase-2 preview engine automatically).
- No migration (offer_config_json is untyped jsonb).
- Production-impacting: Render (backend) + Vercel (brand-web) on push + Mobile
  OTA (OfferBlock).
- Rollback: revert one commit; any offers built with new shapes would then fail
  validation on edit but old offers unaffected.
