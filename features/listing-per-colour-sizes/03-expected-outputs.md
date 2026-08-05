# 03 — Expected outputs

## Files changed
`Packages/brand-web/app/dashboard/products/listing/page.js` — **only file**.

No backend file, no migration, no `Packages/Mobile` file, no API contract change.

## Behavioural deltas

| Area | Before | After |
|---|---|---|
| Colour card stock row | `selectedVariants.map(...)` — global list, every size always shown with a stock box | Same list rendered as **toggle chips**, on by default; off = dash instead of a stock box |
| `addItem` payload (`:411-414`) | `sizes: selectedVariants.map(...)` | `sizes: sizesFor(color).map(...)` |
| `saveEdit` payload (`:453-456`) | identical flattening | identical fix |
| `facets[stockKey]` at save | whatever the top row holds | **union of every colour's sizes** |
| Step-② gate (`:321`) | required variant facets non-empty + ≥1 photo | plus: no selected colour may have zero sizes |
| Edit load (`:164`) | `{ images, stock }` | `{ images, sizes, stock }` |

## Data assertions

For White S/M/L + Blue M/L:

- `variants_json.colors[0].sizes` → 3 entries, sub-SKUs `…-WHI-S/M/L`
- `variants_json.colors[1].sizes` → **2 entries**, sub-SKUs `…-BLU-M/L`
- No `…-BLU-S` sub-SKU exists anywhere
- `facets.size` → `["S","M","L"]`

## Invariants (must not regress)

1. `facets[stockKey]` stays a non-empty subset of the leaf's `allowed_values`
   whenever size is required — else `taxonomy.validateItem` 422s.
2. Per-colour list is always filtered through the master list on read, so
   shrinking the top row can never leave an orphan.
3. A product with all colours sharing all sizes produces **byte-identical**
   output to today.
4. Free-size leaves (`free_size`/`one_size`/`unstitched`) render exactly as
   before.
5. Excel import output shape is unchanged.

## Verification

- Manual: the 10-step workflow in `02-workflow.md`, including the round-trip.
- `pnpm qa` green, no new failures.
- Playwright/Maestro: **not applicable** — no mobile change; brand-web listing
  stepper has no existing Playwright flow to extend.
