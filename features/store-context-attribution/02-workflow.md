# Workflow — Store-context attribution + touch

## Flow A — touch (click-opens-window for known app users)
1. Logged-in follower taps an influencer link (deep-links into the app) or enters a
   creator store → app calls `POST /follower/touch { brand_id, handle|influencer_id }`.
2. Controller resolves the follower (auth) + influencer → refreshes an active
   `attribution_clicks` row for (follower, influencer, brand) to now()+30d, or inserts one.
3. End state: the 30-day brand-scoped window is open without requiring a purchase first.
   Anonymous web clicks (no auth) still fall back to purchase-opens.

## Flow B — store-context in the decision tree (dormant until purchase paths thread it)
1. At fee/attribution time, `computeL3OnFollowerTxn` calls `classifyPath` with optional
   `storeInfluencerId` + `productId`.
2. `classifyPath` order: (1) STORE — `resolveStoreContext` confirms product is actively
   stocked by that influencer AND they're still contracted → influencer_direct + that
   influencer (store_context=true); (2) LIVE LINK (campaign_influencer_id); (3) WINDOW
   (attribution_clicks); (4) DIRECT.
3. End state: when a future purchase path passes storeInfluencerId, an in-store buy
   attributes to the store creator over any window — "store beats window".

## Verification
- Decision logic unit-tested via stubbed client: store>link>window>direct + hijack-proof
  (not-stocked → falls through; stocked-but-not-contracted → direct). 6/6 pass.
- Full app loads (no circular import). DORMANT — no caller passes storeInfluencerId; touch
  endpoint uncalled by any client yet.
