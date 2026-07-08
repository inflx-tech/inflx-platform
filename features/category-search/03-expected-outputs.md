# Expected outputs — category-search

1. `GET /listing/nodes/:id/products?q=` filters by name/description ILIKE within
   the subtree.
2. Mobile CategoryBrowser ⌕ toggles an inline header search input; debounced
   query loads the current category subtree filtered by text; close restores.
3. `listingNodeProducts` + `loadGrid` thread `q`.
4. Search query validated on dev DB; mobile parses + CartScreen test passes;
   `pnpm qa` GREEN.
