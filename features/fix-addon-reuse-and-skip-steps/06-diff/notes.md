# Diff notes — reuse auto-fill + skip-steps

Founder walkthrough fixes.

Bug 1 — "Add from saved" empty for the next dish: prod had 0 templates because
the library only filled on explicit "Save as reusable". Now saving a dish's
groups (replaceAddonGroups) also upserts each into brand_addon_templates by name,
so a group built on one dish appears under "Add from saved" on the next. Existing
prod groups backfilled (2 added to the founder's library).

Bug 2 — wizard restarts from the first step when adding a new dish: required
brand fields include google_maps_url + locality, but those live in brand COLUMNS
(not listing_data), so canSkipBrandSteps always read them empty and never
skipped. Now it treats location as satisfied when the brand has any location
signal (lat/lng/locality/formatted_address) → returning restaurants jump straight
to the menu step.

Verified: food-addon-write 9/9 (incl. "saving product groups auto-populates the
library") + food-addon-templates 3/3; brand-web next build exit 0.
