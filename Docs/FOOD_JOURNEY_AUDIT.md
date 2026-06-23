# Food Follower Journey — Full Code Audit (2026-06-23)

Read-only audit of every screen/component in the food follower journey, run as
5 parallel auditors over `Packages/Mobile/src`. Theme = **NEW** (toing: white +
#F8CB46 yellow + #E11D6B pink) vs **OLD** (creatorVibe: cream/gold/brown) vs
**MIXED**. This is the canonical punch list driving the "no more half-old
screens" reskin pass.

## Why screens are half-old
Work was sliced by *interaction* (discovery → popups → cart). A single screen
(the storefront) was touched by multiple slices and only partly reskinned. The
mechanism that hides this: a `lightColors` / `P` **recolor shim** at the top of
old screens that maps names like `yellow`/`success` onto creatorVibe gold —
so styles that *read* like the new palette still paint gold/cream.

## Theme status — food journey, screen by screen

| Screen / component | Role in food journey | Theme | Reskin |
|---|---|---|---|
| HomeScreen.js | Food world home (section stack) | **NEW** | done |
| CravingRail / CategoryRail | "What's on your mind?" rails | **NEW** | done |
| FoodDishCard.js | Type A dish card + Type B nested | **NEW** | done (veg bug) |
| RestaurantSection.js | Type B restaurant card | **NEW** | done (veg bug) |
| RestaurantResultCard.js | Craving-result restaurant card | **NEW** | done |
| TileSection.js | Template-catalog tiles | **NEW** | done |
| DishDetailSheet.js | Image-tap dish popup | **NEW** | done (veg bug) |
| CustomiseSheet.js | ＋ customise popup | **NEW** | done (veg bug) |
| CartScreen.js | Unified cart | **NEW** | done |
| AddressScreen / AddressDetailsScreen | Checkout address | **NEW** | done |
| DishGroupResultScreen.js | Craving → restaurants (maybe orphaned) | **NEW** | done |
| **RestaurantDetailScreen.js** | **THE storefront** | **MIXED ~85% OLD** | **L** |
| CategoryListScreen.js | Secondary category list | MIXED (mostly OLD) | L |
| OrderDetailScreen.js | Order tracking detail | MIXED (OLD shim) | L |
| **OnlineOrderScreen.js** | **Checkout (pay)** | **OLD** | L |
| OrderConfirmationScreen.js | Post-order success | OLD | M |
| OrderHistoryScreen.js | Orders tab list | OLD | L |
| **DealsScreen.js** | **Offers tab** | **OLD** | L (or strip) |
| FollowerNavigator.js | Bottom nav (5 tabs) | OLD | M |
| FindScreen.js | Find directory | OLD | M |
| DiningSearchScreen.js | Dining search | OLD | M |
| SectionRenderer.js (chrome) | Section host (food cards inside are NEW) | OLD | L |
| ShelfProductCard / ShelfBrand* / DealCard / FeatureCard | Non-food + offer shelves | OLD | M each |
| SavedScreen / MeScreen | Profile-tab (not core food) | OLD | M each |

**Storefront detail (RestaurantDetailScreen):** ONLY the Menu tab + the two
popups are toing. OLD: hero, header, rating pill, meta/open-pill, offer card,
amenity chips, action bar (hardcodes `C.brown`), {Business}×Creators row, Sagar
strip, sub-tabs bar, Overview, Offers/Meals, Reviews, Photos, sticky cart bar,
CTA bar. Root = `lightColors` shim at RestaurantDetailScreen.js:32–42.

## Functional bugs (independent of reskin — fix regardless)

1. **VEG-MARK BUG** — unmarked dishes (`veg_flag = 'na'`, the DB default) render
   as a RED **non-veg** mark. (Founder saw this on "Sambar Rice".) Enum is
   `('veg','non_veg','na')`; display only treats `'veg'` as veg → everything
   else, incl. `'na'`, paints red. Fix: `veg`→green, `non_veg`→red, `na`→neutral
   (no/ grey mark). Locations:
   - `components/food/FoodDishCard.js:36` (home cards) ← the screenshot
   - `screens/follower/RestaurantDetailScreen.js:543` (Menu rows)
   - `components/food/DishDetailSheet.js:38`
   - `components/food/CustomiseSheet.js:198` (add-on rows)
   - `components/restaurant/VegDot.js:20`
   - (filter predicate `RestaurantDetailScreen.js:506` buckets `na` as non-veg —
     filtering, lower priority)
   - DATA: "Sambar Rice" is `'na'` — owner should mark it veg.

2. **`OrderCart` is a DEAD ROUTE → crash.** `BrandStoreScreen.js:120` (and
   `RestaurantDetailScreen.js:158`, the fallback "Order Online →" CTA) call
   `navigate('OrderCart')`, but no `OrderCart` screen is registered in
   `FollowerNavigator` (only `Cart` + `RestaurantCart`). Tapping it throws
   "no route named OrderCart". Real food-path bug.

3. **Dead/duplicate carts:** `RestaurantCartScreen` is registered but nothing
   routes to it; `OrderCartScreen` exists but isn't registered (and is the
   broken target above). The live cart is `CartScreen` (`Cart`). Cleanup:
   delete both dead screens + stale nav.

4. **Hardcoded "Open till 11 PM"** (`RestaurantDetailScreen.js:269`) — always
   shows that, ignores real `brand.open_status`. Display bug.

5. **Follow is local-only** (`RestaurantDetailScreen.js`) — no API persistence.

6. **OrderDetailScreen** items show only name + qty×price — no variation/add-ons/
   note, so the customer can't see what they customised (L166–171).

7. **CartScreen.js:116** passes `offer: cart.offer` but the applied offer lives
   in `cart.appliedOffer` → checkout's discount *estimate* shows empty (display
   only; server re-prices correctly). Minor, introduced in 3C-3.

8. **CategoryListScreen** is section-engine-only; if the engine returns nothing
   it shows "Nothing here yet" with dead legacy dining-card code beneath.

## Recommended sequence (one coherent reskin pass, mockup-locked per group)
1. **Quick functional fixes first** (no reskin, low risk): veg-mark (#1),
   OrderCart dead route (#2), dead-cart cleanup (#3), open-status (#4),
   CartScreen offer field (#7).
2. **Storefront reskin** (#RestaurantDetailScreen shell → toing) — the #1
   "old screen" complaint. Biggest single win.
3. **Order journey reskin** — OnlineOrder → OrderConfirmation → OrderHistory →
   OrderDetail (the pay→track flow).
4. **Offers tab** — strip to the simplified version the founder wants (chips are
   100% hardcoded; backend untouched), or reskin.
5. **Nav + Find + DiningSearch + SectionRenderer chrome** — the remaining shells.
6. **CategoryListScreen** — decide keep vs retire (HomeScreen is the live home).
