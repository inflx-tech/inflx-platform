# 02 — Workflow · Cleanup

1. Admin nav (layout.js): drop Follower Categories + Dish Groups leaves.
2. App Sections (sections/page.js): SCREENS without 'home'; CATEGORIES = real worlds; default screen 'category'.
3. Backend: add `category-restaurants` controller + route (reuse dish-group restaurant SQL; keyword from same-named dish_group or the tile name).
4. Mobile: CategoryListScreen craving rail ← world's follower_vertical_categories (from getVerticals); tap → in-page filter via new endpoint; pre-select from the nav param. Remove DishGroupRail usage.
5. HomeScreen.openCategory passes the category key so the food page pre-filters.

## Verify
- Backend jest for category-restaurants (members + keyword + name match, excludes non-matching).
- pnpm qa green. brand-web build exit 0. Mobile render test green. Maestro post-OTA.
