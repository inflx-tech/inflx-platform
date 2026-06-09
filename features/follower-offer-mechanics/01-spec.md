# follower-offer-mechanics — spec

> MOCKUP LOCKED 2026-06-09 by founder ("yes mockups matched, now start implement").
> Dual-CTA (Order online / Pay at store) confirmed for all item-specific types.

## Problem
The pricing engine (`backend/src/services/offer.service.js → resolveOfferDiscount`)
already PRICES all 5 offer types (discount · volume · bogo · bundle · free_gift)
and returns `{ discount_amount, applied_to, reason, adjustments }`. But the
follower app does not yet **render** type-specific UI, **compose** the cart from
the engine's `adjustments` (it explicitly does NOT auto-add the BOGO/gift item
today — see `resolveBogo` "Future: cart auto-add UX — Tier 3"), or **label** the
resulting order lines. So today every offer looks like a plain discount.

## Scope — one shared module keyed by `offer_type`, reused by every vertical
1. **`OfferBlock(offer)`** — product-detail UI per type:
   - discount → "X% / ₹X off" banner (works any mode)
   - volume → tier ladder (each `{min_spend, pct_off}`, current tier highlighted,
     "add ₹N more to unlock next")
   - bogo → buy → get(₹0) pair + "we'll add the free one"
   - bundle → the `products[]` list + `bundle_price` + "save ₹Z", add-all
   - free_gift → main + gift(₹0) pair, "added automatically"
   Also a compact **card badge + one mechanic line** variant for the shelf/feed card.
2. **`composeCart(offer, pickedItem)`** — acts on the engine's `adjustments`:
   bogo auto-adds get @ ₹0 (qty-matched); bundle adds all bundle products @ bundle
   price; free_gift adds gift @ ₹0; volume/discount = plain product lines.
3. **`orderLines(order)`** — render `follower_orders.items_json` lines with
   free / gift / bundle labels in the Orders screen.

## Rule — refined with founder (2026-06-09): pay-at-store works for ALL types
The split is NOT online-vs-store; it's **"do we know the specific items?"**
- **Discount & Volume** (amount / spend-threshold based) → apply to ANY bill,
  including a free-form walk-in "type my total" pay-at-store (no item pick needed).
- **BOGO / Bundle / Free gift** (tied to specific products) → the follower **picks
  the items / taps the offer in the app first**, then chooses **Pay at store OR
  Order online**. Both carry the picked `items`, so `resolveOfferDiscount` computes
  the deal either way; at the counter the follower shows a **deal QR/code**.
  These can't apply to a pure free-form bill (we can't infer which item is free).

Backend reality (verified): `transaction.controller.js` already has TWO
pay-at-store initiate paths — the legacy one (line ~219) passes `items:[]`
(discount-only on bill), and a newer store-direct path (line ~497) that **already
accepts `items`** and runs them through `resolveOfferDiscount`. So item-aware
pay-at-store is supported today; the follower-side build is the offer block's
**dual CTA (Order online / Pay at store)** + the deal-QR/token at the counter.
Validate item-required offers carry a non-empty item selection before allowing
the free-form-bill path.

## Data source — no phantom fields
Every value maps to `resolveOfferDiscount()` output + the stored
`offer_type` / `offer_config_json` shapes documented in offer.service.js:
- discount `{sub_type:'pct'|'flat', value}`
- volume `{tiers:[{min_spend, pct_off}]}`
- bogo `{buy_product:{id,name,price?}, get_product:{...}}`
- bundle `{products:[{id,name,price?}], bundle_price}`
- free_gift `{offers:[{main:{...}, gift:{...}}]}`

## Out of scope (this contract)
Brand-side offer authoring UI; new offer types; commission attribution (separate
contract). This is follower-facing render + cart composition + order labelling only.

## Surfaces requested by founder for mockup review (DONE)
`04-preview/mockups/offer-mechanics-comprehensive.html` — all 5 types on the
**card** and the **product page**, plus the composed cart + order-line labels.
Mockup-lock pending founder review.
