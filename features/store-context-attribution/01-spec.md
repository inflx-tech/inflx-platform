# Feature Spec — Store-context attribution + touch (decision logic)

> Backend-only. Slice 2 of the Creator Store / commission build. Depends on:
> influencer-store-foundation (stocking + resolveStoreContext). DORMANT.

## Problem / goal
Make the commission decision tree honour "store beats window" and let a logged-in
follower's click/store-entry open the 30-day window (the founder's click-opens insight
for known app users). This slice ships the DECISION LOGIC + the touch endpoint, both
dormant; the per-purchase recording + store-creator commission crediting is the next
slice (validated on a live test transaction because it moves money).

## Scope (in)
- **classifyPath store branch** (`pricing.service.js`): new top-priority branch —
  store > live-link > window > direct. Uses `influencerStore.resolveStoreContext`
  (hijack-proof: product must be actively stocked + influencer still contracted).
  Maps store to the strongest influencer fee tier (`influencer_direct`). Optional args
  `storeInfluencerId` + `productId`; absent → behaviour identical to today (DORMANT).
- **computeL3OnFollowerTxn**: passes the two new optional args through.
- **Touch endpoint** `POST /follower/touch { brand_id, influencer_id|handle }`
  (follower-auth): opens/refreshes the 30-day brand-scoped `attribution_clicks` window
  for the logged-in follower (click-opens-window for known app users).

## Scope (out — next slice, money-path)
- Threading `via_store_influencer_id` through the 4 purchase paths (initiate/verify).
- Recording store-context on `follower_transactions` + crediting the store-creator's
  commission (resolve their contract rate for the brand). Validated on a real test txn.
- Stocking UI + follower Creator Store screen.

## Surfaces
- Backend only (`pricing.service.js`, `follower.controller.js`, `follower.routes.js`).

## Non-functional
- DORMANT: `classifyPath` store branch fires only when a caller passes `storeInfluencerId`
  (none do yet); touch endpoint is new (no client calls it yet). Zero live-money change.
- Decision logic unit-tested (store > link > window > direct; hijack-proof). App loads clean.
