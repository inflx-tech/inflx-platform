# 06 — Before/After · Food storefront reskin

Before: RestaurantDetailScreen opened on an OLD cream/gold "Overview" tab with
the menu buried behind a "Menu (5)" tab; shell painted via a creatorVibe shim.

After: toing white/yellow shell (shim repointed + hardcoded C.* fixed); the menu
is the primary scroll content (search + veg + collapsible categories, always
visible); Overview/Offers/Reviews/Photos demoted to a compact secondary strip;
header shows green rating pill + ETA/distance + free-delivery/open badges + a
pink offer strip; green ADD + green cart bar. Creator-collab + Sagar strips kept.

Verification: metro bundle compiles (full graph); jest suites green. Mobile-only OTA.

## Polish (2026-06-23, post live-test)
- Menu/popup veg marks now render the proper Indian mark — a filled dot inside
  the square (green/red/grey for veg/non-veg/unknown) — instead of an empty
  square that read like a selection checkbox. Applied to RestaurantDetail
  MenuTab + DishDetailSheet + CustomiseSheet.
