# Expected outputs — offer-new-shapes

1. Validator accepts volume `mode:'quantity'` with `min_qty` tiers, and BOGO
   `{product, buy_qty, free_qty}`; old shapes still valid; quantity tier missing
   min_qty fails.
2. Engine: quantity-volume picks the highest met qty tier → pct × scope
   subtotal; same-product BOGO → floor(qty/(buy+free))×free free units +
   adjustments. Old branches unchanged.
3. Builder: Volume mode toggle (spend/quantity) + tier fields; BOGO = one
   product + buy/free qty. buildOfferConfig/draftFromOffer/previewLine updated.
4. PDP OfferBlock renders quantity tiers + same-product BOGO; old shapes still
   render.
5. Cart preview shows new BOGO free item + quantity-volume discount (via the
   Phase-2 endpoint — no cart change).
6. `pnpm qa` GREEN; backend boots; brand-web builds; mobile parses.
