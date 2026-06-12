# Workflow — Sprint 3 cart rebuild

## A. Creator-mediated online order (the fix)
1. Follower opens a product inside a creator's store → ProductDetail has
   `tracking` (cid/sid/CI) + an offer.
2. Picks size + colour → resolves to a priced `variant_id`; optional
   add-ons. Taps **Order Online**.
3. OnlineOrderScreen receives `products`, `tracking`, `offer`,
   variant/add-on selections; builds cart lines carrying `variant_id`.
4. Place Order → `POST /follower/orders` with
   `{campaign_id, set_id, campaign_influencer_id, offer_id?, items:[{product_id,variant_id,quantity}], address_id, delivery_fee}`.
5. Backend `validateTracking` ✓ → offer discount + commission + L3 fee →
   pending order → mock pay → verify → `follower_transactions` +
   `follower_orders` rows (full 4-ID attribution) → Orders tab shows it.

## B. Organic online order (new)
1. Follower opens a product organically (no creator) → `tracking` null,
   `storeOffer` carries `brand_id` only.
2. Picks size/colour/add-ons → **Order Online**.
3. OnlineOrderScreen detects no `tracking` → organic payload
   `{brand_id, items:[{product_id,variant_id,quantity}], address_id}`.
4. Backend `placeOrder` organic branch: approved-brand lookup, no offer,
   discount 0, commission 0, brand-direct L3 fee, variant pricing →
   pending → pay → verify → `follower_transactions` row with
   campaign/set/CI/offer NULL, `offer_source='direct'` → Orders tab.

## C. Address add (fixed)
1. Cart → **+ Add** → Address screen with a real `onSave` callback.
2. On save, callback re-calls `getAddresses`, updates state, auto-selects
   the new address → Place Order enabled.

## Edge cases
- Variant required but unselected → block Order Online with a prompt.
- Discount exceeds bill (organic always 0) → guarded server-side.
- Double-verify race → `consumePendingOrder` atomic claim (existing).
- OTA-lag phones sending the old payload → backend still 422s clearly
  (no silent data loss); new bundle fixes the keys.
