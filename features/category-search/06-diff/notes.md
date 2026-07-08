# Before/after — category-search

## Before
Tapping ⌕ in the category browser navigated to the "Find" screen — a browse
launcher (Browse fashion by category / Eat / Shop tiles), not a search. There
was no product text-search on the node-products endpoint.

## After
- Backend `GET /listing/nodes/:id/products` accepts `q` → name/description ILIKE
  within the recursive subtree (escaped).
- Mobile: ⌕ toggles an inline search bar in the category-browser header. Typing
  debounces (300ms) and queries the CURRENT category's subtree (railNode, else
  selected) filtered by the text; the grid shows the matches; pane title reads
  "Results for '…'". ✕/back closes and restores the selected leaf's grid.
- All-categories tiles + loading views have no search button.

## Verification
- Search query validated on dev DB (subtree + ILIKE compiles/runs).
- CategoryBrowserScreen babel-parses; CartScreen jest 2/2; `pnpm qa` GREEN (79).
- On-device after-capture owed on the OTA.

## Deploy
Render (backend) + follower OTA.
