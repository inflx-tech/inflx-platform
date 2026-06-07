# Before/After — Dictionary parity + add-custom-item

Mockups locked: `01-restaurant-add-own-item.html`, `02-admin-drilldown.html`.

## What shipped (matches mockups)
- **Restaurant (`RestaurantDishPicker.js`):** the dish grid now ends with a dashed
  **"➕ Add your own {Category} item"** tile → inline name + price → `handleAddCustomInSection`
  adds a custom dish under the active cuisine + section (master_dish_id null → live + admin
  review queue). Discoverable in the category view, not just the search box.
- **Admin (`app/admin/master-dishes/page.js`):** the Catalogue changed from a flat table to
  the **Cuisine chips → Category chips → item grid** drill-down (same shape as the restaurant).
  Item tiles show the stock image (or "No image — click to add") + activations badge + name +
  suggested price; click → existing edit modal with the **⬆ Upload stock image** button. A
  **"➕ Add item under {Category}"** tile reuses `openCreate` (already pre-fills cuisine+
  section). Search + pagination retained. No backend change.

## Honest divergences
- "Add cuisine / dish" on the admin side opens the existing create modal (admin types the new
  cuisine name) rather than a separate cuisine-only dialog — minimal, reuses the create path.
- The admin grid keeps the existing "All" cuisine/category options so admin can still see
  everything; the drill-down is the default browse.

## Verification
- `pnpm qa` GREEN (web/api/unit). Founder manual: restaurant adds a custom bread under Breads;
  admin master-dishes shows the drill-down + per-item Edit/image + Add-item tile.
