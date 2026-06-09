# Feature Spec — Influencer Store foundation (stocking + contract-gate)

> Backend-only. The first slice of the Creator Store / commission build. Depends on:
> the locked commission attribution model (project memory). No UI in this slice.

## Problem / goal
The commission model needs a real influencer STORE: a creator shelves products from
brands they're CONTRACTED with, and buying inside that store becomes an attribution
signal (store > window). Today there is no store — only per-campaign "picks"
(`influencer_product_notes`) and a read-only offer aggregation. This slice builds the
stocking backend + the store-context column, leaving the attribution wiring + UIs for
the next slices.

## Scope (in)
- **Migration 094:** `influencer_store_inventory` (influencer × brand × product, unique
  per (influencer,product)) + `follower_transactions.via_store_influencer_id` (dormant
  store-context column).
- **Stocking service** (`influencerStore.service.js`): contract matrix DERIVED from
  `campaign_influencers` (DISTINCT brand_id where contracted/active/completed) — the
  stock-time gate; stock / unstock / list / listStockable; `resolveStoreContext`
  (anti-hijack: product must be actively stocked + influencer still contracted).
- **Stocking endpoints** (influencer-auth): GET `/influencers/me/store/items`,
  GET `/me/store/stockable`, POST `/me/store/items`, DELETE `/me/store/items/:id`.

## Scope (out — next slices)
- Store-context ATTRIBUTION wiring: the `classifyPath` store branch (store > live-link >
  window > direct) + threading `via_store_influencer_id` through the 4 purchase paths +
  window-refresh on store purchase + the authenticated "touch" endpoint.
- Influencer stocking UI (mobile) + follower Creator Store screen rebuild.

## Surfaces
- Backend only (`backend/migrations`, `backend/src/{services,controllers,routes}`). No web,
  no mobile, no money path touched yet.

## Non-functional
- Additive + DORMANT: no caller writes inventory, no transaction reads the new column →
  zero live-money-flow change on deploy.
- Contract-gate enforced server-side at stock time; store-context resolution is
  hijack-proof (must be genuinely stocked + contracted). Validated against live data.
