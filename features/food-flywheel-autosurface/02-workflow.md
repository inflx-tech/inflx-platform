# Workflow Definition — Flywheel auto-surface

## Actor
Restaurant owner (brand, approved), authoring a menu.

## Preconditions
Restaurant A has typed a custom dish not in the dictionary (a pending_dishes row
exists, status='pending').

## Workflow steps (observable)
1. Restaurant B opens the dish typeahead and types a similar term.
2. The suggestions include Restaurant A's custom dish, tagged "added by a
   restaurant" / "N restaurants" (not a canonical match %).
3. B picks it → it's added to B's menu as a custom dish (no master_dish_id) and
   re-captured into the flywheel under B → the cross-restaurant count grows.
4. Canonical dictionary suggestions still appear and rank first.

## Success definition
- `GET /brands/me/dishes/search?q=...` returns the custom with `is_custom:true`,
  `id:null`, `restaurant_count>=1`, grouped once per normalized name.
- A custom whose name already exists canonically is NOT duplicated as a custom.
- Canonical suggestions unaffected.

## Failure / edge workflows
- pending_dishes query errors → canonical typeahead still returns (degrade).
- Same custom typed by many restaurants → one suggestion with the higher count.
