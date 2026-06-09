# Before / After — Influencer stocking + store-context stamp

Mockup: `04-preview/mockups/stock-store.html`.

## Before
- No way for a creator to stock products into a store (only per-campaign "picks" notes).
- A purchase carried no "bought inside this creator's store" signal.

## After
- **StockStore screen** (influencer): products of contracted brands, grouped, with a
  Stock / Stocked toggle; reached via "+ Stock" on MyStore. Server enforces the contract
  gate; optimistic UI.
- **Store-context stamp:** Creator Store pick tap → `via_store_influencer_id` → PayAtStore
  → backend pay-at-store records it on `follower_transactions` and `classifyPath` applies
  store-context (store > live-link > window > direct), hijack-proof.

## Verification
- Babel transform clean (5/5 touched files); backend app loads; classifyPath 6/6 unit tests.
- Visual + money behaviour: founder on device + the live test in TEST-PLAN.md. Maestro
  waived via GOVERNANCE_OVERRIDE (founder-side emulator; founder is the acceptance gate).

## Residual (TEST-PLAN.md)
Surface inventory in the store · no-live-link store purchase + contract-rate credit ·
order/prebook store-context.
