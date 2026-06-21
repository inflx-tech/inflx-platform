# Feature Spec — Reusable customisation templates (saved add-on / variation groups)

## Problem / goal
Restaurants repeat the same add-on / variation groups across many dishes (every
pizza shares the same toppings + crust sizes). Re-typing per dish is wasteful.
Give a per-restaurant library: save a group once, re-apply it to any dish.

## Scope
- In scope:
  - `brand_addon_templates` (brand-scoped saved group definition, jsonb).
  - Backend CRUD: GET/POST(upsert-by-name)/DELETE /brands/me/addon-templates.
  - Customise modal: "Add from saved" (apply a saved group → COPY into the dish)
    + "Save as reusable" (promote a group to the library).
- Out of scope: live-shared/linked groups (we use copy-on-apply so editing one
  dish never changes another, and order snapshots are unaffected). No follower
  UI change (the resulting product groups are the same as before).

## Surfaces touched
- backend: migration 117 + brandAddonTemplates.controller + brand.routes.
- brand-web: CustomiseDishModal (library UI) + lib/api (3 methods).
- Roles: brand (restaurant owner).

## Data / contracts
- `brand_addon_templates(id, brand_id, name, is_variation, definition jsonb)`;
  UNIQUE(brand_id, lower(name)) → re-saving a name updates it.
- definition = `{ selection_type, is_required, min_select, max_select,
  items:[{name, price, is_default}] }`.
- Apply = copy the definition into a new product group (independent thereafter).

## Non-functional
- Copy-on-apply (no cross-dish coupling). Brand-scoped + ownership-guarded.
- Templates round-trip straight into the existing modal group shape.
