# offer-new-shapes — quantity-volume tiers + BOGO-as-same-product (Phase 3)

## Founder decisions (2026-07-08)
### Volume = TWO sub-types
- **Spend tiers** (exists): spend ₹X → Y% off.
- **Quantity tiers** (NEW): buy N units → Y% off ("buy 1 → x%, buy 2 → y%").
  Scoped to a category (any product in it, by total qty) or specific products
  (same product). Discount = pct × scope subtotal.

### BOGO redefined = SAME product
- Real BOGO = buy this product, get another of the SAME product free (a
  different colour/size variant is fine). Buy N → free M of the same product.
- Today's "buy A → get different B free" IS free-gift; that stays as free_gift.
- **Old BOGO offers (buy_product/get_product): LEFT INTACT** (founder deletes
  later). New meaning applies to NEW offers. Engine handles both shapes.

## Shapes (offer_config_json)
- volume: `{ mode?: 'spend'|'quantity' (default spend), tiers: [...], scope,
  category?, products? }` — quantity tiers use `min_qty` instead of `min_spend`.
- bogo NEW: `{ product: {id,name,price}, buy_qty (default 1), free_qty
  (default 1) }`. bogo OLD: `{ buy_product, get_product }` (still valid).

## Scope (files)
- `offerConfig.validator.js` — accept volume `mode`+`min_qty`; bogo new shape
  (product/buy_qty/free_qty) OR old; collect `product` for ownership.
- `offer.service.js` — resolveVolume quantity branch; resolveBogo same-product
  branch (floor(qty/(buy+free))×free free units → adjustments). Old branches kept.
- `OfferBuilder.js` — Volume mode toggle (spend/quantity) + qty tiers; BOGO =
  one product finder + buy/free qty. buildOfferConfig/draftFromOffer/previewLine.
- `OfferBlock.js` (PDP) — render quantity tiers + new same-product BOGO.
- Cart preview needs NO change — new BOGO/quantity-volume flow through the same
  resolveOfferDiscount the preview endpoint already calls (adjustments + reason).

## Acceptance
Admin builds a quantity-volume ("buy 3 → 20% off, category Tees") and a BOGO
("buy 1 get 1 of Puma Tee"). Follower cart with 2 Puma Tees previews 1 free;
cart with 3 Tees previews 20% off. PDP shows both. Old BOGO offers still
resolve. `pnpm qa` GREEN; backend boots; mobile parses; brand-web builds.
