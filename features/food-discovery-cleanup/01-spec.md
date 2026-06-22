# 01 — Spec · Food Discovery Cleanup

Resolves the admin↔app overlap found in the 2026-06-22 audit.

## Problems (verified)
1. **"App Sections → Home" is dead** — the live HomeScreen (Packages/Mobile/.../HomeScreen.js) is hardcoded (world tabs + "What's on your mind?" rail from Home Builder + a "next pass" feed stub). It does NOT read `section_config['home']`. So sections placed under the Home tab (incl. "Food under 400") never render.
2. **Stale scope keys** — App Sections `CATEGORIES` = ['dining','shopping',...]; the real worlds are food/fashion/furniture/beauty/car_rental. So you can't scope a Category section to `food`. (Per-world scope itself is already plumbed: getCategorySections passes scopeType='vertical', scopeValue=key.)
3. **Two craving-tile systems** — `follower_vertical_categories` (Home Builder, images, on HomeScreen) and `dish_groups` (my Slice-3 rail on CategoryList). Duplicate.
4. **Duplicate admin nav** — Follower Categories edits the same `follower_categories` as Home Builder; Dish Groups manages the redundant system.

## Changes
- **Admin:** remove the **Home** tab from App Sections (live home isn't section-driven); fix `CATEGORIES` to real world keys; default screen → `category`. Remove **Dish Groups** + **Follower Categories** from the admin nav (consolidate on Home Builder).
- **App:** CategoryListScreen craving rail now renders the **current world's `follower_vertical_categories`** (same tiles/images as home). Tapping a tile → **in-page** restaurant filter (reuses the 3C-1 mechanism + RestaurantResultCard). Home rail tap pre-selects the craving so the food page opens already filtered (no dead-end page).
- **Backend:** new read-only `GET /follower/category-restaurants` — restaurants serving a category tile (reuse a same-named dish_group's members+keyword when present, else keyword = the tile name → dish-name match). Same payload as the dish-group restaurants endpoint.

## Non-destructive
`dish_groups` tables + endpoints + DishGroupResultScreen stay (optional precise matcher / deep-links); only the app rail + admin nav are unlinked. `section_config['home']` data is untouched (only the admin tab is hidden).

## Out of scope
Building the home feed (the "next pass" stub) to be section-driven; per-dish cuisine mapping for cuisine-named tiles (keyword/name match for now).
