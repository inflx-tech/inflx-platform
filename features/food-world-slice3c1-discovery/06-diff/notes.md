# 06 — Before/After diff · 3C-1 Food home + discovery

**Before** = `04-preview/mockups/discovery.html` (locked 2026-06-22).
**After** = the implemented food home + result screen (Maestro screenshot capture
pending a connected device — see release gate below).

## Mockup → implementation mapping

| Mockup element | Implementation | Match |
|---|---|---|
| Dish-group rail "What are you craving?" | `components/food/DishGroupRail.js` → `GET /follower/dish-groups`; mounted in `CategoryListScreen` dining branch | ✓ |
| Type A "Meals under ₹99" horizontal dish cards (Popular badge, pink ＋, "by restaurant", ★rating · ETA, struck MRP) | `components/food/FoodDishCard.js`; `SectionRenderer` `products` case branches to it when `brand.category==='restaurant'` | ✓ |
| Type B restaurant cards (header rating/ETA/cuisine/free-delivery/→ + nested dish carousel) | `components/food/RestaurantSection.js` + new `restaurant_list` case in `SectionRenderer`; fed by `restaurants_with_featured` rule | ✓ |
| Filter chips (Veg / ₹99 & under / delivery under 30 mins) — functional | `CategoryListScreen` `FOOD_CHIPS` + `dishPasses` client-side prune over food shelves | ✓ |
| Result screen (rating · distance · ETA · free-delivery · varieties · from-price · View menu) | `screens/follower/DishGroupResultScreen.js` → `GET /dish-groups/:id/restaurants` | ✓ |
| ETA distance-derived | `etaFromDistanceKm` (sectionRules.service); applied in result + Type A cards + Type B header | ✓ |
| Struck price per-dish MRP | `brand_products.mrp` (mig 118); surfaced in `mapListedProductItem`, `restaurants_with_featured`, `getProductDetail` | ✓ |
| "Other apps" competitor price | Dropped per founder 2026-06-22 — not implemented | ✓ |

## Deliberate deferrals (later sub-slices, per locked plan)
- ＋ and dish image/name taps route to the existing product screen (`goToProduct`)
  in 3C-1. The customisation popup + dish-detail popup are **3C-2**.
- Storefront reskin (search / MENU jump / collapsible / free-delivery bar) is **3C-2**.
- Cart + offer-picker + organic ordering is **3C-3**.

## Revision 2 (2026-06-22, founder live-test feedback)
- **Craving tile → in-page filter (was: new screen).** Founder wanted Swiggy-style
  behaviour. `DishGroupRail` now toggles a selected craving; `CategoryListScreen`
  fetches `/dish-groups/:id/restaurants` and renders the results **inline**
  (shared `RestaurantResultCard`, extracted from `DishGroupResultScreen` so both
  reuse one card) with a "Clear" bar. Tapping the tile again clears. The
  standalone `DishGroupResultScreen` stays registered for deep-links.
- **Dish-group image upload added to `/admin/dish-groups`.** The builder had no
  image field (so tiles fell back to the plate emoji); added a thumbnail upload
  per row (reuses `uploadAdminStockImage` → `updateDishGroup{image_url}`; backend
  already accepted it).
- **Empty-restaurant finding:** the "restaurants with no dishes" the founder saw
  were the legacy dining-card fallback that triggers only when the section engine
  is empty (no approved restaurant had a menu). In section mode the brand rules
  already gate on `EXISTS pushed_to_store` dishes, so no extra gate was needed
  once restaurants were approved.

## Verification
- Backend `food-discovery-3c1.test.js` 4/4 (ETA formula, Type-B rule featured-first
  + fallback + header, MRP surfaced); `pnpm qa` 79 GREEN (zero regression).
- brand-web `next build` exit 0 (admin Type-B preset).
- Mobile `DishGroupResultScreen.test.js` 2/2 (populate + empty state + nav).
- **Maestro mobile flow: PENDING** a connected device/emulator — required before
  `release.released = true` (gov-check Rule 5). To run post-OTA on prod-as-staging.
