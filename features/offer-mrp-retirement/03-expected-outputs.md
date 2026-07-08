# Expected outputs — offer-mrp-retirement

1. Backend product mappers return no `mrp`; return `discount_value` +
   `offer_price` derived from the best live published-to-store discount offer.
2. `min_discount_pct` filter uses the offer arm only; discount ORDER BY no
   longer references mrp.
3. insertProducts / updateListingProduct no longer write mrp; column remains.
4. brand-web wizard (add+edit+review) + inventory: no MRP field or strike.
5. Mobile card/cart sites: no mrp strike; discount badge sourced from
   `discount_value`; single price when no offer.
6. `pnpm qa` GREEN; backend boots; brand-web builds.
7. Checkout totals unchanged (offer-engine authoritative) — no money regression.
