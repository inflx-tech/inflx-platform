# Workflow — Influencer stocking + store-context stamp

## A — Creator stocks products
1. Influencer → MyStore → "+ Stock" → StockStore screen.
2. `getStockable` + `getMyStoreItems` → products of contracted brands, grouped by brand,
   with a stocked flag.
3. Toggle Stock → `POST /influencers/me/store/items {product_id}` (server re-checks the
   contract gate). Toggle off → `DELETE /store/items/:id`. Optimistic UI, reverts on error.

## B — Store-context on a pay-at-store purchase
1. Follower in a creator's store taps a pick → InfluencerStore passes
   `via_store_influencer_id = creator.id` → PayAtStore forwards it in the body.
2. initiate `computeL3OnFollowerTxn({ storeInfluencerId, productId, ... })` →
   `classifyPath` store branch (hijack-proof) → store creator wins the fee/attribution
   when valid; `meta.via_store_influencer_id` stashed.
3. verify INSERT records `follower_transactions.via_store_influencer_id`.

## Expected end state
A creator can stock contracted-brand products; a store purchase on the pay-at-store path
is stamped with the store creator + classified store-context. Absent the param →
identical to today.

## Verification
- StockStore + all touched files compile (Babel 5/5); backend app loads.
- classifyPath store-branch unit-tested 6/6.
- End-to-end money behaviour proven by TEST-PLAN.md on a live test transaction.
