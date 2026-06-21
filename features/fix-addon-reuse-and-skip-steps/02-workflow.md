# Workflow Definition — reuse auto-fill + skip-steps

## Actor
Restaurant owner with an already-set-up restaurant, editing/adding dishes.

## Workflow steps (observable)
1. Owner builds a "Toppings" group on Pizza A and saves the dish.
2. On Pizza B → "Add from saved" → "Toppings" is already there → apply (copy).
3. Owner clicks "Add" a new dish on an already-set-up restaurant → the wizard
   skips the brand steps and goes straight to the menu/listing step.

## Success definition
- After saving product groups, GET /brands/me/addon-templates includes them.
- A returning restaurant (has products + location in columns) → canSkipBrandSteps
  returns true → menu step directly.

## Failure / edge workflows
- Brand with NO products → full wizard (unchanged).
- Brand genuinely missing a required non-location field → full wizard.
