# offer-engine-store-direct — Sub-contract D2: store-direct purchase (backend)

> **Sub-contract D of 4 — Phase 2 (backend money path).** Adds the endpoints a
> follower uses to buy a store-published offer with **no influencer** — no
> tracking IDs, **zero commission**, full brand margin. Builds on D1 (publish +
> surfacing + `follower_transactions.brand_offer_id`/`offer_source` from
> migration 085). **Backend-only.** Follower-mobile wiring + STORE DEAL UI = D3.
> Ships **dormant**: no client calls the new endpoints until D3.

## Problem / goal
D1 lets brands publish offers to their store and surfaces them, but a follower
can't yet *buy* a store-direct offer — every purchase path today requires the
4 tracking IDs + `campaign_influencer_id` (via `validateTracking`). D2 adds a
parallel, additive purchase path that resolves the offer from `brand_offers`,
credits no commission, and writes a `follower_transactions` row attributed to the
brand offer (`offer_source='store'`).

## Scope
- **In scope (backend):**
  - New endpoints (follower-auth): `POST /follower/store-offer/pay` +
    `POST /follower/store-offer/verify`.
  - `initiateStoreOfferPay`: validate `brand_id` + `brand_offer_id` + positive
    `bill_amount`; fetch the offer via a new `fetchStoreOfferOrThrow` (must be the
    brand's, `status='active'`, `published_to_store=true`, within store window →
    else `409 OFFER_UNAVAILABLE`); compute discount via the shared
    `resolveOfferDiscount`; **commission = 0**; L3 marketplace fee via
    `pricingService.computeL3OnFollowerTxn({ campaignInfluencerId: null })`
    (classifies as `'direct'`); create the Razorpay order with store meta.
  - `verifyStoreOfferPay`: consume the stashed order; INSERT
    `follower_transactions` with `campaign_id/set_id/campaign_influencer_id/
    offer_id = NULL`, `brand_offer_id` set, `offer_source='store'`,
    `influencer_commission=0`; **no influencer credit, no attribution_clicks
    write**; settle the brand's net share via the existing
    `settlementService.settleCommerceTransaction` (unchanged).
  - QA: full pay→verify happy path (discount, zero commission, null tracking IDs,
    `offer_source='store'`); unpublished/cross-brand → 409; validation → 422;
    **zero regression** to the existing pay-at-store/order flows.
- **Explicitly out of scope:**
  - Follower-mobile STORE DEAL rendering + buy-button wiring → **D3**
    (Mobile-governed; Maestro; OTA).
  - Engagement-promotional offer UI in the wizard → D3.
  - Returns/refunds for store-direct (reuses existing return window; no new logic).

## Surfaces touched
- **App(s):** backend only (`transaction.controller.js` + `transaction.routes.js`).
- **Roles:** follower (authenticated, `requireRole('follower')`).

## Data / contracts
- **No migration** — uses `follower_transactions.brand_offer_id` + `offer_source`
  (migration 085, D1). The 4 tracking IDs are already nullable.
- **New endpoints** (envelope unchanged):
  - `POST /follower/store-offer/pay` `{ brand_id, brand_offer_id, bill_amount, items?, product_id?, variant_id? }` → `{ razorpay_order_id, amount_to_charge, discount_amount, breakdown:{ influencer_commission:0, platform_fee, brand_net } }`.
  - `POST /follower/store-offer/verify` `{ razorpay_order_id, razorpay_payment_id }` → `{ transaction_id, reference_code, net_amount, brand_name }`.
- **Writes:** one `follower_transactions` row, `transaction_type='pay_at_store'`,
  `offer_source='store'`, all tracking IDs NULL, `brand_offer_id` set,
  `influencer_commission=0`.

## Non-functional
- **Auth/role gates:** follower JWT. Offer must belong to the named brand + be
  published/active/in-window (defense in depth; the UI only lists own store
  offers).
- **Failure modes:** unavailable offer → 409; bad input → 422; discount >
  bill → 422; Razorpay verify is mock-safe (stashed-meta amounts, like
  pay-at-store).
- **Deploy posture:** PRODUCTION-IMPACTING (`backend/src`) but **DORMANT** — new
  endpoints with no caller until D3; existing pay-at-store/order/prebook flows
  untouched (additive functions + routes). Backend-only → Render, no migration/
  OTA/web. Explicit go before push.
