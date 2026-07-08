# category-search — real in-category product search (replaces wrong Find nav)

## Founder (2026-07-08, live)
Tapping the category-browser search (⌕) opened the old all-categories "Find"
screen (the browse launcher). Wrong. It should open a SEARCH BAR that searches
locally within the current category's items (products in that subtree).

## Root cause
The earlier counts/search fix wired ⌕ → navigation.navigate('Find') — a
category browse launcher, not a product search. And there was no product text-
search on the node-products endpoint.

## Fix
### Backend
- `GET /listing/nodes/:id/products` accepts `q` → matches `name`/`description`
  ILIKE within the node's recursive subtree (escaped).

### Mobile (OTA)
- ⌕ now toggles an inline search bar in the CategoryBrowser header (no more
  Find nav). Typing debounces (300ms) and queries the CURRENT category's whole
  subtree (railNode, else selected) filtered by text; grid shows the matches;
  pane title reads "Results for '…'". Closing search restores the leaf grid.
- `listingNodeProducts` passes `q`; `loadGrid` threads it through.

## Acceptance
In the Polo browser, tap ⌕ → search bar; type "cotton" → the grid shows cotton
products across that category; clear/close → back to normal. `pnpm qa` GREEN;
search query validated on dev DB; mobile tests pass.
