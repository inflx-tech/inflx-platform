# Feature Spec — Influencer stocking screen + store-context purchase stamp

> UI-governed (Mobile) + a small backend stamp. Makes the influencer store testable.

## Problem / goal
Give a creator a screen to shelve products into their store (the stocking foundation's
endpoints exist but had no UI), and make a purchase made INSIDE a creator's store carry
the store-context signal end-to-end on the pay-at-store path.

## Scope (in)
- **Stocking screen** (`screens/influencer/StockStoreScreen.js`): lists products the
  creator may stock (contracted brands only — gate enforced server-side), grouped by
  brand, with a Stock / Stocked toggle. Reached via a "+ Stock" button on MyStore.
  Backed by the `/influencers/me/store/{stockable,items}` endpoints + api methods.
- **Store-context stamp (pay-at-store):** `via_store_influencer_id` flows app →
  initiate → `computeL3OnFollowerTxn` (store-context branch) → recorded on
  `follower_transactions.via_store_influencer_id` in verify. Creator Store's pick tap
  passes it; PayAtStore forwards it. Additive — absent → behaviour identical.

## Scope (out — remaining for the full stocked-product commission loop)
- Surfacing the new inventory inside the follower Creator Store (resolveStore still
  shows campaign offers, not `influencer_store_inventory`).
- A NO-live-link store purchase path (pay-at-store requires campaign_id/set_id/
  campaign_influencer_id today) + crediting the store creator from their CONTRACT rate
  when there's no campaign offer. (See TEST-PLAN.md "remaining gaps".)
- Order / prebook store-context (only pay-at-store wired this slice).

## Surfaces
- Mobile influencer (StockStore + MyStore button + nav), mobile follower
  (InfluencerStore pick tap, PayAtStore forward), backend `transaction.controller`
  (pay-at-store), `services/api.js`.

## Non-functional
- OTA-safe; NATIVE_RUNTIME '3'. Backend additive/dormant. Contract-gate server-side.
- JSX validated via Babel; backend app loads; classifyPath store-branch unit-tested.
