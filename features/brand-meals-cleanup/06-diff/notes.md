# Before / After — meals dead-code cleanup (brand)

**Before:** `BrandMealsBoardScreen` (290 LOC) was still registered in `BrandNavigator` and
reachable from a `restaurantOnly` Meals quick-action on the brand Home — for a vertical the
founder has since cut ("fashion only; meals is dead").

**After:** screen deleted; navigator import + `BrandMealsBoard` route removed; the Meals
quick-action removed along with the `restaurantOnly` filter it was the last user of.

## Safety (verified before deleting)
- The screen's only API call was `brandApi.getMe`, used in **7** other places — nothing was
  orphaned.
- `restaurantOnly` had exactly **one** consumer (the Meals tile), so the filter went too.
- Post-delete grep for `BrandMealsBoard` / `restaurantOnly` / `label: 'Meals'` → clean.
- Mobile jest **105/105 green** (unchanged — the deleted screen had no tests).

## Deliberately NOT deleted (surfaced instead of assumed)
The **follower** food/restaurant subsystem is much larger and has **4 live passing test
suites**: `MealsChatScreen`, `RestaurantDetailScreen`, `RestaurantBookingScreen`,
`RestaurantBillScreen`, `DishGroupResultScreen`, `services/FoodOrderContext.js`,
`components/food/*`, `components/restaurant/*`.

It belongs to the separate follower fashion-rebuild program, and removing it would delete
working, tested code plus its tests. That is a bigger decision than this cleanup's remit, so
it stopped at the brand boundary and is raised for an explicit founder call.
