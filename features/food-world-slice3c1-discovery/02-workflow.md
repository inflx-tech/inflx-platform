# 02 — Workflow · 3C-1 Discovery

## User flow

1. Follower opens the **Food** world → `CategoryListScreen` (eat).
2. Below the sub-cat bar, the **dish-group rail** loads from
   `GET /follower/dish-groups`. Tiles show image + name.
3. Follower taps a tile (e.g. "Biryani") → `DishGroupResultScreen` opens with
   `{ groupId, groupName }`.
4. Result screen calls `GET /follower/dish-groups/:id/restaurants?lat&lng`
   (lat/lng from `LocationContext`) → renders restaurant cards ranked by
   distance then popularity.
5. Follower taps **"View menu →"** on a card → existing `BrandStore` route
   for that `brand_id` (storefront as-is; reskin is 3C-2).

## Build steps

1. `services/api.js`: add `getDishGroups()` →
   `GET /follower/dish-groups`; `getDishGroupRestaurants(id, { lat, lng })` →
   `GET /follower/dish-groups/:id/restaurants`. Mirror existing
   `api.request()` envelope handling (no raw fetch).
2. New component `components/food/DishGroupRail.js` — fetches groups, renders
   the horizontal rail, `onPressTile(group)` callback. Hidden when empty.
3. New screen `screens/follower/DishGroupResultScreen.js` — header + restaurant
   list, loading/empty states, "View menu" → `BrandStore`.
4. Wire `DishGroupRail` into `CategoryListScreen` dining branch (between the
   sub-cat bar and the restaurant cards). Tile press →
   `navigation.navigate('DishGroupResult', { groupId, groupName })`.
5. Register `DishGroupResult` in `FollowerNavigator`.
6. Maestro flow: open Food → rail visible → tap a tile → result screen renders
   → tap "View menu" → storefront opens.

## Verification

- `npx jest` Layer-3 render tests for `DishGroupResultScreen` (renders cards
  from a mocked payload; empty state on `[]`).
- `pnpm qa` green (no regression). Mobile build clean.
- `pnpm qa:maestro` flow green on device/emulator.
- Manual: founder tests live on prod-as-staging after OTA.
