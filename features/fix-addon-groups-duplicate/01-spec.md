# Feature Spec — Fix: duplicate addon/variation groups on save

## Problem / goal
Founder report (2026-06-21): saving a dish's add-ons/variations created MANY
duplicate groups (e.g. "Choose your toppings" ×16). DB inspection confirmed a
powers-of-2 accumulation on one product (24 groups). The bulk-replace endpoint
itself is correct (delete+insert; verified), so the cause was a client-side
state carry-over sending a growing payload. Fix it definitively at the data
layer + harden the client.

## Scope
- In scope:
  - Migration 116: collapse existing duplicate groups (keep min(id) per
    product_id+name) + a UNIQUE index (product_id, name) so duplicates can never
    persist.
  - Backend bulk-replace: dedupe the incoming groups by normalized name (a
    doubled payload collapses to one; never violates the index).
  - brand-web: add a React `key` to CustomiseDishModal (fleet-edit + wizard) so
    it always remounts fresh per dish — no state carry-over between edits.
- Out of scope: no change to the customisation model or order path.

## Surfaces touched
- backend: migration 116 + productAddons.controller.replaceAddonGroups.
- brand-web: ListingTemplateLayout (fleet edit modal) + RestaurantDishPicker
  (wizard modal) — add `key`.

## Data / contracts
- New UNIQUE index on product_addon_groups(product_id, name). No new columns.
- `POST /products/:id/addon-groups` now collapses same-named groups before write.

## Non-functional
- Idempotent migration; existing duplicates collapsed (24→2 on prod).
- A product can never hold two groups with the same name.
