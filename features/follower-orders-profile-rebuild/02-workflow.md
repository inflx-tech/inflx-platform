# Workflow — Orders + Profile rebuild

## Orders
1. Tab open → getActivity() → unified items (kind: order/booking/pay_at_store + via-creator
   + savings + status + booking date).
2. Tabs filter: Active (in-progress), Orders/Bookings/Visits (by kind), History (done),
   Enquiries/Returns (empty until wired). Order cards show the tracker from status.
3. Tap → OrderDetail (track/view) or BrandStore.

## Profile
1. Focus → getMe (profile) + getActivity/getFollowing/getSavedOffers (counts) + getWallet.
2. Render profile card, stats, wallet card → FollowerWallet, Refer&Earn, menu rows, logout.

## Verification
- Babel clean (both screens); backend app loads. Founder verifies on device after OTA.
