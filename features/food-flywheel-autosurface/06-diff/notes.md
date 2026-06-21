# Diff notes — Flywheel auto-surface

Minor enhancement to the existing restaurant dish typeahead (no new screen).

What changed:
- backend `dishFlywheel.searchMasterDishes` now also returns custom dishes from
  `pending_dishes` (status='pending'), grouped by normalized name, flagged
  `is_custom` with a `restaurant_count`, excluding names already canonical.
- brand-web typeahead: custom suggestions show a purple "added by a restaurant" /
  "N restaurants" badge (vs the green match-% for canonical), and picking one
  adds it as a custom dish (no master_dish_id) so it re-captures under this brand.

Verified: `food-flywheel-surface.test.js` 3/3 (custom surfaces to another
restaurant; grouped with count; canonical unaffected + not duplicated). brand-web
`next build` exit 0. After-capture vs the live typeahead to be eyeballed
post-deploy with a logged-in restaurant account.
