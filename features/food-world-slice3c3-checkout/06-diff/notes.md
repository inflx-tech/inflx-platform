# 06 — Before/After · 3C-3 Cart + Checkout + home dish-add flow

Mobile-only OTA (no backend, no migration). Diff is behavioural; the "before"
reference is `04-preview/mockups/cart.html`, the "after" is the live follower
app (verified by founder on device + the jest suites below).

## Part A — cart-side
- **CartScreen** (`Packages/Mobile/src/screens/follower/CartScreen.js`): was
  creatorVibe-themed and rendered only `variant_label`; now Toing palette, each
  line shows its **customisation** (variation + add-ons + note), per-line **Edit ›**
  reopens CustomiseSheet pre-filled, **offer-picker** over `cart.storeOffers`
  (manual apply → `brand_offer_id`), bill (item total, MRP savings, offer
  savings, total), **green Place Order**.
- **Carry-to-order**: `CartScreen.checkout` + `OnlineOrderScreen.placeOrder` now
  thread `variation` / `selected_addons → addons` / `note` + `brand_offer_id`
  into the `POST /follower/orders` body (both DROPPED them before).
- **Organic ordering**: `RestaurantDetailScreen` gate relaxed —
  `canOrder = brand.category === 'restaurant' || online_order_supported`. Any
  restaurant dish is now orderable; other verticals keep the explicit toggle.
- **CartContext**: line carries `mrp` + display labels; cart carries
  `storeOffers` + `appliedOffer`; new `replaceLine` / `applyOffer` / `clearOffer`.
  Persistence (AsyncStorage) was already present — cart survives app close.
- **CustomiseSheet**: added the per-dish **note** input (was hardcoded null) +
  an `initial` prop so Edit reopens pre-filled.

## Part B — unified home dish-add flow (founder 2026-06-23)
- New **FoodOrderProvider** (`src/services/FoodOrderContext.js`) hosts
  DishDetailSheet + CustomiseSheet app-wide (mounted in `App.js`).
- **SectionRenderer** wires `FoodDishCard` (Type A) + `RestaurantSection` nested
  dishes (Type B): image tap → DishDetailSheet, ＋ → CustomiseSheet/add. These
  previously routed to the old flat `ProductDetailScreen`.
- On ADD (with OR without add-ons) the dish enters the persistent cart **and the
  app navigates INTO that restaurant's storefront** (collapsible menu) so the
  follower keeps adding. Cross-brand adds raise the Replace-cart dialog.

## Verification
- Metro **bundle compiles** clean (full graph; real gate for the untested screens).
- Jest: `CartScreen` 2/2, `FoodOrderContext` 2/2, `CustomiseSheet` pass,
  `HomeScreen`/`DishGroupResultScreen` pass. Full suite: only the 2 pre-existing
  baseline failures remain (FollowerWalletScreen transform + RestaurantCartScreen
  Alert — task_f93a7677), NOT from this slice.
- Maestro gate NOT run (no device this window) — `release.released` stays false.
