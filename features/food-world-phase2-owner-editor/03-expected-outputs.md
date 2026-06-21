# Expected Outputs — Food World Phase 2: owner editor

## Backend (Slice A) — asserted by tests/food-addon-write.test.js

1. **POST addon-groups (bulk-replace)** — owner posts a variation group
   (Portion: Half ₹70 default / Full ₹114) + an add-on group (Accompaniment,
   multi, max_select 3, Roti +₹15 / Chapathi +₹15). Response 200/201; DB has
   2 groups + 4 items with correct flags.
2. **GET addon-groups** — returns the nested `{ groups:[{...,items:[...]}] }`
   shape, sorted by sort_order; `is_variation`/`is_default` booleans correct.
3. **Round-trip parity** — the follower `GET /follower/products/:id`
   (Phase 1) returns the identical `addon_groups` for the same product.
4. **Bulk-replace removes dropped groups** — re-POST with only the variation
   group → add-on group + its items gone; variation intact.
5. **Ownership guard** — brand B POSTs to brand A's product → 403, no write.
6. **Validation** — `is_variation:true`+`multi` → 422; empty items → 422;
   negative price → 422; none of these write partial rows.
7. **badge/is_featured/featured_sort** — PATCH /brands/me/products/:id sets
   them; GET product reflects them.
8. **Snapshot safety** — after an order is placed referencing an add-on, a
   subsequent bulk-replace that deletes that add-on leaves the order's
   `items_json` snapshot unchanged.

## Frontend (Slice B) — brand-web (verified via before/after diff)
- A "Customise" button on each dish row opens the modal (matches the locked
  mockup `04-preview/mockups/owner-editor.html`).
- Variations + add-on groups builder, "Pull from my menu" assist, badge +
  featured, delivery-settings control.
- On save, calls the endpoints above; re-open shows persisted state.

## Regression
- `pnpm qa` GREEN (no change to existing product create/update behaviour for
  non-food brands; addon endpoint is additive).
