# Feature Spec — Meals dead-code cleanup (brand scope)

> Deletion-only. Founder locked 2026-07-25: "no meals, nothing. our focus is only
> fashion industry...that meals one is dead."

## Problem / goal
With food out of scope, the brand mobile Meals board is dead code. Remove it and its
entry points.

## Scope
**In scope (brand only)**
- Delete `screens/brand/BrandMealsBoardScreen.js`.
- `BrandNavigator`: remove the import + `BrandMealsBoard` route.
- `BrandHomeScreen`: remove the 'Meals' quick-action **and** the now-unused
  `restaurantOnly` filter (Meals was its only user).

**Explicitly OUT of scope — surfaced, not deleted**
The **follower** food/restaurant subsystem is far larger than the brand screen and was NOT
touched: `MealsChatScreen`, `RestaurantDetailScreen`, `RestaurantBookingScreen`,
`RestaurantBillScreen`, `DishGroupResultScreen`, `services/FoodOrderContext.js`,
`components/food/*`, `components/restaurant/*` — plus **4 live passing test suites**
(DishGroupResult, RestaurantBill, RestaurantBooking, FoodOrderContext). It belongs to the
separate follower fashion-rebuild program; deleting it needs its own decision + contract.

## Surfaces touched
- Mobile (brand) only — OTA. No web, no backend.

## Data / contracts
- None. The deleted screen's only API call was `brandApi.getMe` (used in 7 other places).

## Non-functional
- Zero behaviour change for non-restaurant brands; restaurant-category brands lose a tile
  for a feature that is no longer part of the product.
