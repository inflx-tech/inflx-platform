# Workflow Definition — Fix duplicate addon groups

## Actor
Restaurant owner editing a dish's add-ons/variations.

## Preconditions
A dish with customisation groups (possibly previously duplicated).

## Workflow steps (observable)
1. Owner opens Customise on a dish → sees each group ONCE (not duplicated).
2. Owner edits + clicks "Save customisation" → the set is saved once.
3. Re-opening shows the same single set (no growth on repeated saves).

## Success definition
- A product never holds two groups with the same name (DB unique index).
- A doubled client payload collapses to one per name (controller dedupe).
- Existing duplicates are gone (migration 116: 24→2 on prod).
- Normal multi-group saves (distinct names) still work.

## Failure / edge workflows
- Client sends same group twice → backend keeps one (no error, no dup).
- Two genuinely-different groups must have different names (by design).
