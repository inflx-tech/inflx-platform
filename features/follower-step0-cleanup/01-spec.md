# 01 — Spec · Follower Step 0 (cleanup + cheap fixes)

First execution step from the full follower-app audit (Docs/FOLLOWER_APP_MAP.md).
Goal: shrink the confusion pile — remove dead code and fix cheap, real bugs —
before the per-surface reskin packages begin. Mobile-only OTA, no backend.

## Scope
1. DELETE dead/orphaned screens (verified zero live callers): OrderCartScreen,
   RestaurantCartScreen (+test), SchemaDetailScreen, SalonDetailScreen,
   SlotPickerScreen, LookbookDetailScreen, LookbookCard; remove nav refs.
2. Repoint the broken `OrderCart` route (RestaurantDetail 'order' -> Menu tab;
   BrandStore 'online_order' -> 'Cart').
3. Veg-mark fix: utils/veg.js vegKind(); 'na' -> neutral grey (not false red).
4. Login: drop hardcoded register city/state; remove prod test-OTP hint.

## Out of scope (deferred, surfaced separately)
- Mock-payments -> real Razorpay (PreBook/RestaurantBooking/RestaurantBill).
- CarBooking real date picker.
- Storefront + order-journey reskins (next packages).
