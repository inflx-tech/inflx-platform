# Workflow — Dictionary parity + add-custom-item

## Restaurant (add own item under a category)
1. Add dishes → pick cuisine → pick category (e.g. Breads) → dish grid.
2. Grid ends with a dashed **"➕ Add your own Breads item"** tile.
3. Click → inline name + price → Add → the custom dish is added under the active cuisine +
   section (master_dish_id null → goes live + into the admin review queue). Owner then sets
   photo/price like any dish.

## Admin (same drill-down)
1. Master dishes → Catalogue → **Cuisine** chips (All + each cuisine + "➕ Add cuisine/dish").
2. Pick a cuisine → **Category** chips appear → pick one.
3. **Item grid** for that cuisine+section: each tile shows the stock image (or "No image —
   click to add"), activations badge, name, suggested price. Click → edit modal with
   **⬆ Upload stock image** + fields. A **"➕ Add item under {Category}"** tile opens the
   create modal pre-filled with the active cuisine+section. Search still available.

## Expected end state
- Admin and restaurant see the identical Cuisine → Category → Item dictionary.
- A restaurant can add a unique item under any category without using the search box.
- Admin seeds/updates each item's stock image inline in the drill-down.

## Verification
- `pnpm qa` GREEN. Founder manual: restaurant adds a custom bread under Breads; admin
  master-dishes shows the drill-down + per-item upload.
