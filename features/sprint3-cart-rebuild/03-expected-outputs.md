# Expected outputs — Sprint 3 cart rebuild

## Backend (`POST /follower/orders`)
- Creator order: `{campaign_id, set_id, campaign_influencer_id, offer_id?,
  items:[{product_id, quantity, variant_sku?, variant_label?}], address_id}`
  → 201 `{razorpay_order_id, net_amount, breakdown}`; after verify →
  `follower_transactions` (full 4-ID attribution) + `follower_orders`
  (`order_status='confirmed'`, `items_json` carries variant_sku/label).
- Organic order: `{brand_id, items:[...], address_id}` → 201; after verify →
  `follower_transactions` with campaign/set/CI/offer **NULL**,
  `influencer_commission = 0`, brand-direct L3 fee; `follower_orders`
  confirmed.
- Missing both creator triple and brand_id → 422.

## Frontend
- `OnlineOrderScreen`: cart lines show `colour · size`; `+ Add` selects the
  new address; Place Order runs create → pay → verify; success routes to
  OrderDetail.
- `ProductDetailScreen`: `Select Colour` + `Select Size` render from
  `variants_json.colors[]`; Order Online blocked until a size is chosen;
  chosen variant rides into checkout.

## Proof (recorded)
- `pnpm qa` 79/79 GREEN (report 2026-06-12T02-43-51Z).
- `journey-phase-a.js` 32/32 PASS — S6.4 (creator) + **S6.4b (organic)**.
