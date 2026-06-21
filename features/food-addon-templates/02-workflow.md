# Workflow Definition — Reusable customisation templates

## Actor
Restaurant owner editing a dish's customisation.

## Preconditions
A restaurant with at least one dish.

## Workflow steps (observable)
1. Owner builds a group (e.g. "Crust": Medium/Large) on a pizza and clicks
   "Save as reusable" → it's stored in the brand's library.
2. On another pizza, the owner clicks "Add from saved" → picks "Crust" → a COPY
   of the group is added to this dish (editable independently).
3. Saving the dish persists the group as a normal product addon group.
4. Re-saving a template with the same name updates the library entry.

## Success definition
- POST /brands/me/addon-templates stores the group (upsert by name);
  GET lists the brand's templates; DELETE removes one.
- Applying a template adds an independent copy to the current dish.

## Failure / edge workflows
- Template with no name or no options → 422.
- Another brand cannot see/delete this brand's templates (ownership).
- Editing a dish's copy does NOT change the template or other dishes.
