# Feature Spec — Fixes: reusable library auto-fill + wizard skip-steps

> Founder walkthrough (2026-06-21), two bugs.

## Problem / goal
1. **Reuse library empty** — a variation/add-on group built on one dish did not
   appear under "Add from saved" on the next dish (the library only filled on
   explicit "Save as reusable"; the owner expects automatic reuse).
2. **Wizard re-asks everything** — adding a new dish to an already-set-up
   restaurant restarted the wizard from the first brand step. `canSkipBrandSteps`
   checked `listing_data` for the required location fields (google_maps_url /
   locality), but those live in brand COLUMNS, so it always read "empty" and
   never skipped.

## Scope
- In scope:
  - Backend: when product groups are saved (replaceAddonGroups), upsert each into
    the brand's reusable library (brand_addon_templates) by name. + a prod
    backfill of existing groups.
  - brand-web: canSkipBrandSteps treats the location requirement as satisfied
    when the brand has location in its columns (lat/lng/locality/
    formatted_address) — so returning restaurants jump straight to the menu step.
- Out of scope: the library/skip mechanisms themselves (already built).

## Surfaces touched
- backend: productAddons.controller.replaceAddonGroups.
- brand-web: publishDriver.canSkipBrandSteps.

## Data / contracts
- No schema change. Saving a group now also upserts brand_addon_templates.
- canSkipBrandSteps logic only (reads brand.lat/lng/locality/formatted_address,
  which getListingConfig already returns).

## Non-functional
- Auto-fill is idempotent (upsert by name). Skip-steps still shows the full
  wizard for a brand with NO products or genuinely-missing required fields.
