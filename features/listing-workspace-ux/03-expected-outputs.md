# Expected outputs — Listing Workspace UX

## Layout

| # | Expectation |
|---|---|
| L1 | Page fills the viewport up to 1720px; no 960px centred column anywhere on the Listings screen. |
| L2 | Add + Inventory render three panes: tree rail · centre · right rail. Offers renders two (tree · centre). |
| L3 | Below 1150px the panes stack to one column and stay usable. Nothing overflows horizontally at any width. |
| L4 | Edit mode (`?edit=`) renders a single centred surface — no tree, no tray. |

## Navigation

| # | Expectation |
|---|---|
| N1 | The tree shows the full vertical; clicking a category expands it and moves the centre to that level. |
| N2 | Clicking an item-type (leaf) anywhere in the tree opens the wizard for it, with facets loaded. |
| N3 | The branch containing the current selection auto-expands, and the selected row is visibly active. |
| N4 | Breadcrumb still works and stays in sync with the tree. |

## Add products

| # | Expectation |
|---|---|
| A1 | Steps ① Basics ② Variants/Photos ③ Details ④ Review are unchanged in content, order and validation. |
| A2 | Staged items appear in the right-hand tray, with count, price, remove, and the Save button. |
| A3 | "Save N products" calls `listingApi.batchCreate` once and reports created count + SKUs. |
| A4 | Bulk-Excel path (template → upload → errors/success → photo tray) is unchanged. |

## Inventory

| # | Expectation |
|---|---|
| I1 | Table columns: select, photo, product + facet summary, brand, variants, SKU, price, stock, status, actions. |
| I2 | "All products" lists the flat catalogue; a leaf lists that leaf's products. |
| I3 | Row Edit / Hide / Show / Remove behave exactly as before. |
| I4 | Selecting rows shows the bulk bar; Hide / Show / Remove / Edit price apply to every selected row and report `n updated, m failed` truthfully. |
| I5 | Stat tiles and status/brand filters reflect the current selection. |
| I6 | Header search filters by name or SKU. |

## Non-goals asserted

| # | Expectation |
|---|---|
| X1 | No new/changed API endpoint, table or migration. |
| X2 | Bulk "Move category" and "Attach offer" are absent (deferred — need backend). |
| X3 | Brand mobile listing is untouched. |

## Verification

- `pnpm qa` GREEN, gate 0, zero regression vs the pre-change baseline.
- `node --check` clean on every touched file.
- Manual walk of W1–W4 at 1440px and 1280px.
