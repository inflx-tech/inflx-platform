# Expected Outputs — Dictionary parity + add-custom-item

## Restaurant
- The dish grid (under a selected cuisine+category) shows a dashed **"➕ Add your own
  {Category} item"** tile → inline name+price → adds a custom dish (section = active
  category, master_dish_id null). It appears in "Added dishes" and the live preview.

## Admin master-dishes
- Catalogue view is a **Cuisine chips → Category chips → Item grid** drill-down (not a table).
- Item tiles show the stock image (or "No image — click to add") + activations + name +
  suggested price; clicking opens the edit modal with the stock-image upload.
- A **"➕ Add item under {Category}"** tile opens the create modal pre-filled with the active
  cuisine + section. Search retained; pagination retained.

## Gate
- `pnpm qa` GREEN; C1 GREEN; mockup_locked + non-empty 06-diff.
- Release: production-impacting (Vercel brand-web); founder go. No backend, no migration.
