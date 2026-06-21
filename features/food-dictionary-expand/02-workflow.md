# Workflow Definition — Food dictionary expansion

## Actor
System migration (no user). Downstream: a restaurant owner in the listing
wizard; a follower searching dishes.

## Preconditions
`master_dishes` seeded with the original 129 rows.

## Workflow steps (observable)
1. Run migration 114 → Continental Pizza/Pasta/Garlic Bread move to a new
   Italian cuisine; renamed sections reconcile; net-new dishes inserted.
2. `master_dishes` count goes 129 → 360, 0 duplicates.
3. Re-run migration 114 → still 360 (idempotent).
4. Restaurant wizard `GET /brands/me/master-catalogue` now lists the full
   dictionary by cuisine→section (13 cuisines incl. Italian, Fast Food,
   Beverages, Eggs & Breakfast, Bowls & Meals).

## Success definition
- master_dishes = 360, 0 exact dupes, 0 same-(cuisine,name) cross-section dupes.
- Migration is idempotent (second run is a no-op on counts).

## Failure / edge workflows
- In-CSV duplicate (cuisine,section,name) → would double-insert; prevented by
  generator de-dup (verified 0).
- Section rename → existing dish moves via reconcile, not duplicated.
