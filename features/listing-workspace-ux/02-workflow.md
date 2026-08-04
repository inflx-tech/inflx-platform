# Workflow — Listing Workspace UX

> The end-to-end path a brand walks, and the end state that counts as success.

## W1 — Add products to an item type (primary path)

1. Brand opens `/dashboard/products/listing` → **Add products** tab.
2. Left rail shows the whole vertical tree (Men / Women / Unisex / Kids …).
   Centre shows the current level as cards.
3. Brand clicks a category in the tree → it expands **and** the centre shows
   that level's cards. No screen swap, no lost context.
4. Brand clicks an item type (leaf), from either the tree or a card →
   `listingApi.getNodeFacets` loads, centre becomes the 4-step wizard, right
   rail becomes the staging tray.
5. Steps ① Basics → ② Variants/Photos → ③ Details → ④ Review, unchanged.
6. "+ Add this item" stages it → the item appears in the **right-hand tray**
   (not below the fold) and the form resets carrying brand + detail facets.
7. Repeat 5–6 for more products.
8. "Save N products" in the tray → `listingApi.batchCreate` → success banner
   with SKUs, tray empties, the leaf's count increments in the tree.

**End state:** N products exist under the chosen leaf, the brand never lost
sight of the batch, and they can jump to another item type in one click.

## W2 — Browse and manage inventory

1. **Inventory** tab. Left rail = the brand's own tree with product counts;
   "All products" sits at the top.
2. Selecting a leaf → `GET /brands/me/listing-nodes/:id/products` → table.
   Selecting "All products" → `brandApi.getProducts()` flat list.
3. Right rail shows stat tiles for the selection and status/brand filters;
   filters narrow the table client-side.
4. Row actions Edit / Hide / Show / Remove behave exactly as today.
5. Selecting rows reveals the bulk bar → Hide / Show / Remove / Edit price.
   Each loops the existing per-product endpoint and reports
   "n updated, m failed" honestly.
6. Search box in the header filters by name or SKU across the flat list.

**End state:** the brand can find any product and change it — one at a time or
in bulk — without drilling the tree repeatedly.

## W3 — Bulk Excel (unchanged)

Leaf selected → "Bulk add (Excel)" → download template → upload → row errors or
success + photo tray. Behaviour, validation and copy are untouched; only the
surrounding layout changes.

## W4 — Edit one product (`?edit=<id>`)

Tree and tray are hidden; the wizard renders as a single centred surface and
saves via `PATCH /brands/me/listing-products/:id`. Unchanged behaviour.

## Success test

`pnpm qa` GREEN with zero regression, and each of W1/W2/W3/W4 reaches its end
state in the real app at 1440px and at 1280px.
