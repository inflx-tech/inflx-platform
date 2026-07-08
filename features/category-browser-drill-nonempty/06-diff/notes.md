# Before/after — category-browser-drill-nonempty

## Before (v189)
CategoryBrowser drilled correctly (tap a branch → its children fill the rail),
but a node with NO leaf child (a segment like "Men") loaded no grid → the right
side was EMPTY until the follower drilled down to a leaf. Opening a banner at a
segment looked broken.

## After
Init and drill now fall back to `loadGrid(node)` when there's no leaf child.
`listingNodeProducts` already returns the recursive subtree, so:
- Open at "Men" → rail = Men's subcategories (Topwear, Bottomwear…), grid = all
  Men's products.
- Tap Topwear → rail = Tees, Polo, Shirts…, grid = Topwear products.
- Tap Tees (leaf) → Tees products + facets.
Never an empty grid; the rail always shows the level's subcategories. Leaf-level
behavior (e.g. Bracelets & Bangles) unchanged.

## Verification
- CategoryBrowserScreen babel-parses; `pnpm qa` GREEN (79).
- On-device after-capture owed on the OTA: open a banner at Men → rail +
  products; drill Topwear → Tees/Polo + products.

## Deploy
Mobile OTA only. No backend, no web.
