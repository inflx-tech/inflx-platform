# Feature Spec — Follower Orders + Profile rebuild (Creator-Vibe)

> UI-governed (Mobile) + a small additive backend feed. Screens #8 + #9 — the last
> two non-Reels screens.

## Problem / goal
Rebuild Orders (OrderHistoryScreen) + Profile (MeScreen) to orders-comprehensive.html
and orders-profile-comprehensive.html. Orders today shows only online orders; the mockup
is a unified inbox of all transaction types.

## Scope (in)
- **Backend `/follower/activity`** (additive, read-only): unified feed from
  follower_transactions (online_order/pay_at_store/prebook) + brand + via-creator
  (4-ID) + savings + order_status (tracker) + booking date/type. Normalized items.
- **Orders rebuild:** title + tabs (Active/Orders/Bookings/Visits/Enquiries/Returns/
  History) + per-kind cards (order tracker · booking date/ref · pay-at-store amount+
  savings) + via-creator chip. Enquiry/Return tabs honest-empty (feeds not yet unioned).
- **Profile rebuild:** profile card · stats (Orders/Following/Saved) · Wallet card
  (getWallet) · Refer & Earn banner · menu rows (Orders/Following/Saved/Addresses/
  Returns/Settings) · logout (preserved).

## Scope (out)
- Enquiry + return feeds in /activity (separate tables; wired later).
- Refer & Earn invite backend (placeholder alert; ties to referral model later).
- Order/booking/return flow screens (already exist).

## Surfaces
- Backend: transaction.controller listActivity + route + api method.
- Mobile follower: OrderHistoryScreen, MeScreen.

## Non-functional
- OTA-safe; NATIVE_RUNTIME '3'. Backend additive (new read endpoint). Babel-validated;
  backend app loads. Counts/wallet best-effort (blank, not faked, on failure).
