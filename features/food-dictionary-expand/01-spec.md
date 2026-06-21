# Feature Spec — Food dictionary expansion (master_dishes 129 → 360)

## Problem / goal
The restaurant dish dictionary (`master_dishes`, cuisine→section→dish) was
regional-heavy but thin on everyday search terms (Pizza, Burger, Momo,
Shawarma, Rolls, Sandwich, Waffles, Juices/Shakes, Eggs, Bowls/Meals). This
expands it to a comprehensive, founder-reviewed ~360-dish dictionary so
restaurants can list common items and discovery has terms to match.

## Scope
- In scope: additive seed of `master_dishes` (migration 114) generated from the
  locked CSV `backend/seeds/food_dictionary.draft.csv`; split a new **Italian**
  cuisine out of Continental (Pizza/Pasta/Garlic Bread, via UPDATE so existing
  rows move not duplicate); re-section renamed sections; 5 new cuisines
  (Italian, Fast Food, Eggs & Breakfast, Bowls & Meals, Beverages) + Momos
  section under Chinese.
- Out of scope: the flywheel auto-surface of custom dishes (separate slice) and
  the tap-dish→restaurants-nearby discovery wiring (separate slice).

## Surfaces touched
- backend/migrations only (data). No code, no UI.
- Roles: restaurants (the wizard reads this dictionary); followers (search).

## Data / contracts
- `master_dishes` rows added (129 → 360). Idempotent: insert-if-missing keyed on
  (cuisine, section, name); reconcile-by-(cuisine,name) for renamed sections;
  cuisine moves for the Italian split. Re-runnable, 0 duplicates.
- No schema change, no new tables/columns.

## Non-functional
- Idempotent + additive (no deletes). Validated on a clean 129 baseline:
  129 → 360, run twice = 360, 0 exact dupes, 0 same-name-different-section dupes.
