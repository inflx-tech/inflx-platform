# Impact — offer-mrp-retirement

**Verdict: display-layer change across 3 codebases; checkout money UNCHANGED.**

- Backend: product payload loses `mrp`, gains offer-derived `discount_value` /
  `offer_price` (reuses proven offer clauses — no new pricing math). Filter/sort
  lose their MRP arm. Writes stop; column dormant (reversible).
- brand-web: MRP field removed from wizard + inventory.
- Mobile: ~11 render sites drop the MRP strike; badge now offer-driven.
- Risk: a product with a live offer must surface `discount_value` or its card
  goes flat — covered by the mapper change + verified in QA. Non-discount offer
  types show on PDP/offer surfaces, not as a browse-card %.
- Production-impacting: Render (backend) + Vercel (brand-web) on push; Mobile
  needs an OTA publish to show on device. Explicit go + OTA surfaced.
- Rollback: revert one commit (column still present; re-add field).
