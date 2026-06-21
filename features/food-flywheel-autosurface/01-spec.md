# Feature Spec — Flywheel auto-surface of custom dishes

## Problem / goal
When a restaurant types a dish not in the dictionary, it is captured into
`pending_dishes` but stays invisible to every other restaurant until an admin
manually promotes it. Founder wants: a custom dish one restaurant enters should
show up as a SUGGESTION to the next restaurant that types something similar — so
the dictionary grows organically.

## Scope
- In scope: surface captured customs (pending_dishes, status='pending') in the
  restaurant dish typeahead, grouped by normalized name with a restaurant count,
  flagged `is_custom` (no master_dish_id). Picking one adds it as a custom dish
  (re-captured under the picker's brand → grows the cross-restaurant count).
- Out of scope: auto-inserting customs into canonical `master_dishes` (admin
  promotion still owns that — keeps the canonical dictionary clean). The dish
  picker GRID stays canonical-only (customs have no cuisine to slot into).

## Surfaces touched
- backend: `dishFlywheel.searchMasterDishes` (union pending customs).
- brand-web: `RestaurantDishPicker` typeahead (label customs; pick → custom add).
- Roles: restaurant owners (authoring).

## Data / contracts
- No schema change. Reads `pending_dishes` (migration 087).
- `GET /brands/me/dishes/search` response `matches[]` may now include items with
  `is_custom:true, id:null, restaurant_count:N, norm_name`.

## Non-functional
- Best-effort: a failure in the custom query never breaks the canonical
  typeahead (try/catch → []).
- Dedup: customs whose normalized name already exists canonically are excluded;
  customs are grouped by norm_name (shown once with a count).
