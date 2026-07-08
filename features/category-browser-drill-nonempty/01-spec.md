# category-browser-drill-nonempty — never-empty grid on hierarchical drill

## Founder (2026-07-08) — expected browser behavior
Banner → "Men" → rail shows Men's subcategories (Topwear, Bottomwear…) → tap
Topwear → rail shows Tees, Polo… → tap deeper for sub or products. Level-by-
level drill, and each level should show relevant products, not a blank grid.

## Gap in v189
The drill already works (onSelectRail drills into branches). But when the
opened/drilled node has NO leaf children (e.g. a segment like "Men", whose
children are categories/branches), the code loaded no grid → the right side was
EMPTY until the follower drilled to a leaf.

## Fix (mobile, OTA)
`CategoryBrowserScreen` init + drill: when there's no leaf child, load the grid
with the node's OWN subtree products (`loadGrid(node)`), since
`listingNodeProducts` already returns the recursive subtree. So:
- Open at "Men" → rail = [Topwear, Bottomwear…], grid = all Men's products.
- Tap Topwear → rail = [Tees, Polo…], grid = Topwear products.
- Tap Tees (leaf) → Tees products.
Never an empty grid; the rail always shows the level's subcategories.

## Acceptance
Opening the browser at any level (segment / category / leaf) shows the rail of
that node's subcategories AND a populated product grid; drilling narrows both.
`pnpm qa` GREEN.
