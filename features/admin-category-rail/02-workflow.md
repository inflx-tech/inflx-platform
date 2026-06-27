# 02 — Workflow: admin-category-rail

## Admin journey
1. App Builder → Scope **Home** → World **Fashion**.
2. Add Section → "Category rail (pick from catalogue)".
3. Expand it → "Pick categories": the catalogue tree (Men → Bottomwear → Jeans …)
   renders indented; tap nodes at any level to add/remove them.
4. Selected tiles list below → optional rename + emoji icon per tile.
5. Publish → `config_json.nodes[]` saved on the section (`PUT /admin/sections/category`).

## Render + tap (follower)
6. Home → Fashion fetches sections; the `category_nodes` rule turns the saved nodes
   into rail tiles, each carrying `category_node_id` + `vertical`.
7. `SectionRenderer` `nav_tiles` → `CategoryRail`; the mapper passes the node id through.
8. Tap a tile → `navigateCategory` sees `category_node_id` → opens `CategoryBrowser`
   at that node (Phase-1 sidebar + grid + filters).

## Failure modes
- World without a tree (food/beauty/cars) → picker shows a note; no nodes pickable.
- No nodes picked → rail emits nothing (empty, no crash).
- Tile whose node was deleted → browser shows 404/empty gracefully (Phase-1 behaviour).
