# Expected outputs — category-browser-drill-nonempty

1. Init at a branch node with no leaf child → `loadGrid(node)` (subtree
   products), rail = node's children.
2. Drill into a branch with no leaf child → `loadGrid(child)` (subtree
   products).
3. Leaf selection unchanged (leaf products).
4. `pnpm qa` GREEN; CategoryBrowserScreen parses.
