# 06 — Before/After · Follower Step 0 (cleanup + cheap fixes)

Mobile-only OTA, no backend/migration. Cleanup + bugfix pass — no new screen
design. Driven by `Docs/FOLLOWER_APP_MAP.md`.

## Deletions (dead code removed — verified zero callers first)
- `OrderCartScreen.js` — navigated from 2 places but never registered (broken
  route); callers repointed (below).
- `RestaurantCartScreen.js` + its test — registered but never navigated (dead
  duplicate; the live cart is `CartScreen`). Removing the test also clears one
  of the two pre-existing baseline failures (task_f93a7677).
- `SchemaDetailScreen.js`, `SalonDetailScreen.js`, `SlotPickerScreen.js` — the
  old salon detail+booking path; unregistered, no callers.
- `LookbookDetailScreen.js` + `components/cards/LookbookCard.js` — fashion
  lookbook; registered but unreachable (card imported nowhere).
- `FollowerNavigator` imports + `Stack.Screen` registrations for RestaurantCart
  + LookbookDetail removed.

## Fixes
- **Broken `OrderCart` route** → `RestaurantDetailScreen` 'order' now opens the
  Menu tab; `BrandStoreScreen` 'online_order' now opens the live `Cart`.
- **VEG-MARK bug** (the "Sambar Rice shows non-veg" report): new `utils/veg.js`
  `vegKind()` returns `veg` / `nonveg` / `unknown`. Unmarked dishes (`veg_flag =
  'na'`, the DB default) now render a **neutral grey** mark instead of a false
  **red non-veg** mark. Applied at all 5 sites: FoodDishCard, RestaurantDetail
  MenuTab (display + veg filter), DishDetailSheet, CustomiseSheet, VegDot.
- **Login leaks:** removed hardcoded `city:'Vijayawada'/state:'AP'` sent on
  follower register; replaced the prod-visible "For testing use: 000000" hint
  with a real instruction.

## Verification
- Metro bundle compiles clean (full graph, post-deletion).
- Jest: food component suites + CartScreen + FoodOrderContext green; the deleted
  RestaurantCart test no longer fails (it's gone with its dead screen).

## Explicitly deferred (their own surfaced tasks — NOT in this pass)
- Mock-payments → real Razorpay (PreBook / RestaurantBooking / RestaurantBill).
- CarBooking real date picker (currently shows placeholder dates).
- Storefront + order-journey toing reskins (the next packages).
