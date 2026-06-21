# Feature Spec — Food dish groups (discovery tiles)

## Problem / goal
Followers need to tap a dish-type tile (Biryani, Paratha, Pizza) on the food
home and see nearby restaurants serving it. Admin defines the tiles + which
dictionary dishes belong to each; tapping resolves to restaurants by distance.

## Scope
- In scope (this contract — Slice 3A + 3B):
  - Data model: `dish_groups` (tile) + `dish_group_dishes` (member master_dishes)
    + optional name `keyword` (migration 115).
  - Admin CRUD + member picker with auto-suggest (brand-web /admin/dish-groups),
    gated `requireCapability('master_data')`. Build-direct (founder waived UI
    mockup).
  - Follower discovery endpoints: list tiles; tap → nearby restaurants serving
    any member dish OR keyword-matched dish, by distance + 30-day popularity,
    with varieties + from-price + rating + delivery info.
- Out of scope (Slice 3C, later): the follower mobile UI (tiles rail + result
  screen) — built after the founder creates tiles + lists real restaurants.

## Surfaces touched
- backend: migration + adminDishGroups.controller + follower.controller
  (getDishGroups / getDishGroupRestaurants) + routes.
- brand-web: /admin/dish-groups page + adminApi + nav.
- Roles: admin (build tiles); follower (discover).

## Data / contracts
- New tables `dish_groups`, `dish_group_dishes` (mig 115). No change to others.
- Admin: `GET/POST/PATCH/DELETE /admin/dish-groups`, `GET/PUT
  /admin/dish-groups/:id/members`, `GET /admin/dish-groups/suggest?q=`.
- Follower: `GET /follower/dish-groups`, `GET
  /follower/dish-groups/:id/restaurants?lat&lng`.

## Non-functional
- Match = explicit member master_dish_ids OR `name ILIKE keyword` (safety net
  for custom dishes; reliable because dishes are listed in-hierarchy).
- Restaurants filtered to approved + category='restaurant' + in-store products;
  ranked by haversine distance then popularity.
