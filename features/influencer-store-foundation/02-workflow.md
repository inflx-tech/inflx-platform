# Workflow — Influencer Store foundation

## Actors
- **Influencer** (auth): stocks/unstocks products into their store.
- **System**: enforces the contract matrix at stock time; exposes the store.

## Flow
1. Influencer opens "stock my store" → GET `/influencers/me/store/stockable`
   → service lists active products of every brand the influencer is contracted with
   (DISTINCT brand_id from campaign_influencers where status contracted/active/completed),
   each flagged `stocked`.
2. Influencer shelves one → POST `/influencers/me/store/items { product_id, note? }`
   → service re-derives the product's brand, re-checks the contract gate, upserts an
   `influencer_store_inventory` row (active). Non-contracted brand → 403.
3. Influencer removes one → DELETE `/me/store/items/:id` → status archived.
4. GET `/me/store/items` → the live stocked store (active items + product/brand detail).
5. (Next slice) at purchase time, `resolveStoreContext({influencerId, productId, brandId})`
   confirms the product is actively stocked + influencer still contracted → returns the
   influencer_id so attribution can mark the sale Path-A store-context.

## Expected end state
A creator can build a real store limited to their contracted brands; the store-context
resolver exists and is hijack-proof. No money flow changes (dormant).

## Verification
- Modules load (node require — clean).
- Live-data read-only validation: a real creator's contracted-brand set + stockable list
  resolve correctly; `resolveStoreContext` returns null for a non-stocked product.
- Migration 094 applied to prod (table + column verified present).
- pnpm qa not runnable in sandbox (test DB unreachable) — slice is additive + dormant.
