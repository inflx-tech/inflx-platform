# Feature Spec — Dictionary parity + add-custom-item-under-category

> Status: LOCKED (founder 2026-06-07 "pls go and build it"). brand-web only, no backend.

## Problem / goal
Two gaps the founder found while dogfooding the restaurant Add-dishes screen:
1. **No parity:** the restaurant browses the dish dictionary as a **Cuisine → Category →
   Items** drill-down, but the **admin master-dishes** tab is a flat filterable table — a
   different mental model for the same data.
2. **No add-custom-item-under-category:** in the restaurant's category grid (e.g. North
   Indian → Breads) there is **no discoverable way to add a unique item not in the
   dictionary**. The only path is the top search box ("type a name → add your own"),
   which isn't visible from the category view (`RestaurantDishPicker.js` grid had only the
   dictionary items + a "No dishes" message).
Goal: one consistent Cuisine → Category → Item model on both surfaces, and a clear
"add your own item under {Category}" everywhere.

## Scope
- **In scope (brand-web only):**
  - **Restaurant (`RestaurantDishPicker.js`):** an inline **"➕ Add your own {Category} item"**
    tile in the dish grid → name + price → adds a custom item under the active cuisine +
    section (master_dish_id null → live + admin review queue, same as the search custom-add).
  - **Admin (`app/admin/master-dishes/page.js`):** restructure the catalogue from the flat
    table to the **same Cuisine → Category → Item drill-down** (cuisine chips → section
    chips → item grid). Each item tile shows its stock image; click opens the existing edit
    modal (with the "⬆ Upload stock image" button shipped earlier). An **"➕ Add item under
    {Category}"** tile reuses the create modal (pre-filled cuisine+section). Search retained.
- **Out of scope:** backend (the dictionary endpoints, custom-add flywheel, and stock-upload
  all already exist); non-restaurant verticals.

## Surfaces touched
- brand-web: `app/dashboard/products/components/restaurant/RestaurantDishPicker.js`,
  `app/admin/master-dishes/page.js`. No backend, no migration.

## Non-functional
- Custom item add is non-destructive (goes through the existing onItemAdd + flywheel).
- Admin restructure reuses existing data (`listCuisines`, `listMasterDishes`) + handlers
  (`openCreate` already pre-fills from the active filter; `openEdit` opens the upload modal).
- Gate: `pnpm qa` green; UI-governed → mockup_locked + 06-diff; Vercel deploy founder go.
