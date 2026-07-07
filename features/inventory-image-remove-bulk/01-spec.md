# Inventory page — real images, working Remove, bulk delete

**Founder 2026-07-06 (screenshot, /dashboard/products fashion):** product rows
show a dress-icon placeholder instead of the photo; Remove "doesn't work"; and
edit/remove/toggle are one-by-one — wants multi-select bulk delete.

## Root causes (all verified)
1. **Image placeholder** — `DefaultFleetRow` (ListingTemplateLayout.js) rendered
   `{icon || '📋'}`, never `product.image_url`, even though the leaf endpoint
   (`getMyNodeProducts`) already returns a resolved image_url.
2. **Remove not working** — `getMyNodeProducts` had NO `is_active` filter (and
   sorted `is_active DESC`), so after a soft-delete the leaf refetch STILL
   returned the removed product → the row never disappeared. The delete itself
   worked; the list lied.
3. **No bulk delete** — only per-row Remove existed.

## Fix
- Backend `getMyNodeProducts`: add `AND bp.is_active = true` (drop the
  is_active-DESC sort) → removed products vanish on refetch.
- `DefaultFleetRow`: render `product.image_url` (object-cover) with the icon as
  fallback; add an optional select checkbox.
- `DrilldownFleetView`: `selected` Set state (cleared on leaf change), a
  per-row checkbox, "Select all", and a sticky bulk bar → "🗑 Delete selected
  (N)" loops single DELETEs (no bulk endpoint exists), then refetches.

## Scope
brand-web dashboard + one backend WHERE clause. No migration, no mobile/OTA.
