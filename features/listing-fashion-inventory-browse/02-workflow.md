# Workflow — Fashion inventory browse

## Actor
Authenticated brand whose category is a drill-down vertical (fashion / furniture),
store setup already complete (so the products tab redirects them to the listing page).

## Happy path
1. Brand opens **Inventory** → redirected to `/dashboard/products/listing`.
2. Page shows two tabs: **My listings** (default) and **Add products**.
3. **My listings** loads `GET /brands/me/listing-tree` → the vertical's tree with a
   per-node `product_count` (rolled up from the brand's own products, any status).
4. Brand sees only the segments they have listed in, each with a count badge
   (e.g. `Women · 186`). Taps a segment → its categories → a leaf.
5. Leaf tap loads `GET /brands/me/listing-nodes/:id/products` → this brand's
   products under that leaf's subtree (all statuses, live first).
6. Each row: image, name, ₹price (+ MRP strike), SKU, stock, Live/Hidden pill,
   and actions **Hide/Show** + **Remove**.
7. **Hide** → `PATCH /brands/me/products/:id {is_active:false}` → row flips to
   Hidden; **Show** flips it back. **Remove** → `DELETE` (soft) → row leaves the
   live set. Both re-fetch the leaf so counts/status stay truthful.
8. At any point the brand types in **Search** → the flat `GET /brands/me/products`
   is fetched once and filtered by name/SKU; matching rows render with the same
   actions. Clearing search returns to the folder drill-down.
9. **Add products** tab → the existing wizard, byte-for-byte unchanged.

## Empty / edge states
- Brand with 0 listed products → **My listings** shows an empty state pointing to
  **Add products** (no naked empty tree).
- Leaf with only hidden products → rows still render, all showing the Hidden pill.
- Tree fetch fails → inline error; **Add products** tab still works.
- Non-drill-down vertical never reaches this page (redirect logic unchanged), so
  the tab never renders for them.

## Backend
- `GET /brands/me/listing-tree` (new, brand-scoped): derive vertical from
  `brand.category`; `taxonomy.getTree`; one `GROUP BY category_node_id` count for
  the brand; roll counts up the tree; return `{ vertical, tree }`.
- `GET /brands/me/listing-nodes/:id/products` (new, brand-scoped): recursive
  subtree over `category_nodes`; `brand_products WHERE brand_id = me AND
  category_node_id IN subtree`; all statuses; live-first order.
- Mutations reuse existing `PATCH` / `DELETE /brands/me/products/:pid`.
- No migration; no change to the public follower browse endpoints.
