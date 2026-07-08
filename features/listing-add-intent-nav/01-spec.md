# listing-add-intent-nav — "Add item" lands on the add flow, not My listings

## Problem (founder, 2026-07-08)
On the store page (FleetView tab strip: "{Items} (N)" + "Add {item}"), every
add-intent button for drill-down brands routes through `gotoProductWizard()`
→ `/dashboard/products/listing` with NO param
(ListingTemplateLayout.js:102, 460, 480, 492-493). The listing page defaults
to `view='browse'` (My listings) — so clicking "Add item" shows the browse
screen and the brand must click "Add products" a second time. "My listing is
useless [there]" — founder.

## Fix (scope locked)
1. `gotoProductWizard()` → `/dashboard/products/listing?tab=add`.
2. Listing page view init honors `?tab=add` → `view='add'` (alongside the
   existing `?edit` and `?tab=offers` cases).

## Non-goals
No tab removal/renames; browse remains default for plain `/listing` (Listings
nav click). Tags-at-listing is a separate contract (listing-tags-at-add).

## Acceptance
Fashion brand: store page → "Add item" → lands directly on the drill-down
category picker (Add products tab active). "Items (N)" tab behavior unchanged.
`pnpm qa` GREEN.
