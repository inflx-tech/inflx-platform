# 03 — Expected Outputs: Phase 5e/5f Store + Checkout Sweep

## Visual
- Brand Store: gold/cream palette, per-business accent CTAs (unchanged).
- Every active gold control across Deals/Orders/RestaurantDetail/Profile/Error now
  shows **ink** text on its gold background (no white-on-gold).
- Wallet card: gold background, ink balance + label + arrow.

## Functional (unchanged — must hold)
- Deals filter/sort, order tabs, restaurant Follow/Directions, refer/invite,
  error retry — all behave exactly as before.

## Gate
- `pnpm qa`: 79/79 GREEN, gate 0. No backend/DB/migration.

## Sweep list closure
After this contract, the 5a "known-not-swept" white-on-gold list is fully resolved
on live surfaces (Home 5b · CategoryList/CreatorCategory 5c · InfluencerStore 5d ·
Deals/Orders/MeScreen/RestaurantDetail/ErrorBoundary 5f), except items deliberately
left as correct (ProductDetail toggle knob; on-dark/on-accent texts).
