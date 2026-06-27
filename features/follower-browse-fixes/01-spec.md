# 01 — Spec: follower-browse-fixes (walkthrough batch 1)

Fixes from the founder's live fashion walkthrough (2026-06-27). Batch of two
category-browser fixes; the store-page rebuild (#2) is a separate mock-first contract.

## #1 — "All" tile routed to the legacy Find screen → **fix**
The category rail's "All" tile (`category_nodes` rule) routed `key='all'` to the old
global `Find` screen (`SectionRenderer.navigateCategory`). It must stay **inside the
world**: open the category browser showing **all of that world's categories**.
- `navigateCategory`: `key==='all'` + `vertical` → `CategoryBrowser { vertical, title:'All categories' }`.
- `CategoryBrowserScreen`: support a **vertical-only entry** (no nodeId) → fetch
  `/listing/tree`, show the world's top categories, drilled into the first so the grid
  isn't empty.

## #3 — Filter sheet looked rough → **restyle**
The filter/sort bottom sheet (`CategoryBrowserScreen` Modal) was visually rough. Restyle
to the toing system: a grab handle, rounded pills, **solid-pink selected state** (was a
faint tint), larger touch targets + section spacing. No behaviour change.

## Out of scope
- #2 store-page (BrandStore) rebuild — separate contract, mock-first.

## Acceptance
- Tapping "All" opens the in-world category browser (not Find).
- The filter sheet reads clean (handle, rounded pills, clear selected state).
- Mobile compiles; jest unchanged-green.
