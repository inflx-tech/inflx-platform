# 01 — Spec: per-colour sizes in the fashion listing stepper

**Slug:** `listing-per-colour-sizes`
**Surface:** brand-web only (`Packages/brand-web/app/dashboard/products/listing/page.js`)
**Class:** UI-governed. NOT mobile-governed. No backend, no migration, no API change.

---

## Problem

Step ② of the one-by-one product stepper picks **one global size list** and reuses
it verbatim for every colour.

`page.js:286`

```js
const selectedVariants = stockKey ? arr(draft.facets[stockKey]) : [];
```

`page.js:414` (addItem) and `page.js:456` (saveEdit) both build the saved payload as:

```js
sizes: selectedVariants.map(val => ({ size: val, stock: draft.variants[color]?.stock?.[val] ?? null }))
```

So a brand selling a T-shirt in White S/M/L and Blue M/L cannot say so. Blue is
forced to carry S with a stock box the brand must leave at 0. The follower app
then shows Blue/S as a real, selectable variant that can never be fulfilled.

Founder report (2026-08-05, screenshot): *"sizes may vary based on colour … if I
select colours then it should ask sizes and stock per each size as well as pics
should be within same colour, unlike selecting sizes for all at a time and
showing it uniformly to all colours."*

## Why this is UI-only

The persisted shape **already models per-colour sizes**. `buildVariants`
(`backend/src/controllers/listing.controller.js:62-82`) maps `cv.sizes` per colour
and never assumes the lists match:

```js
out.colors.push({ color, images: [...], sizes });   // sizes derived from cv.sizes
```

The **Excel bulk import already produces correct per-colour sizes** — it is
row-per-colour-per-size by construction (`listingBulk.service.js` column model:
`Colour *`, `Size`, `Variant stock`). Only the web stepper flattens.

Therefore: no backend change, no migration, no API contract change, and no
change to the Excel path.

## Target behaviour

The top Size row keeps its meaning as the product's **full size range** — it is
the master vocabulary and it is what feeds `facets.size`. Inside each colour card,
those sizes render as **toggle chips, all ON by default**, each with its own stock
input.

- Common case (all colours share sizes) — **zero extra clicks**, identical to today.
- Exception (Blue has no S) — **one tap** on S inside the Blue card removes it for
  Blue only.

This was chosen over "pick sizes fresh inside every colour card" because the
common case is shared sizes; making the brand re-pick 8 sizes for each of 3
colours would be a regression in effort for the majority path. Both designs
produce the same stored data.

## Scope

### In
1. Per-colour size list in draft state, defaulting to the global list.
2. Toggle chips + per-size stock inside each colour card.
3. `addItem` / `saveEdit` build `sizes` from the colour's own list.
4. `facets[stockKey]` written as the **union** of every colour's sizes on save.
5. Step-② gate blocks when a selected colour has zero sizes.
6. Edit-mode load restores each colour's own size list.

### Out
- The Excel import path (already correct).
- Per-size price override (`sizes[].price` exists in the shape; the web stepper
  has never collected it — unchanged here).
- Mobile. There is no product-add screen in the RN brand app.
- Any follower-app change.

## Acceptance

| # | Condition | Expected |
|---|---|---|
| A1 | 2 colours, all sizes on | Saved exactly as today — no behaviour change |
| A2 | White S/M/L, Blue M/L | `variants_json.colors[]` carries different `sizes[]` per colour |
| A3 | Reopen A2 in edit | Both per-colour lists come back intact |
| A4 | Toggle every size off for one colour | Next is blocked with a named reason |
| A5 | Global size removed after per-colour edit | That size disappears from every colour |
| A6 | `facets.size` after A2 | Union `[S, M, L]`, not the raw global list |
| A7 | Free-size leaf (Saree, Dupatta, unstitched) | Unchanged — no size row, photos + colours only |
| A8 | Excel import | Untouched, still per-colour correct |

## Constraint — do not break

`facets[stockKey]` is read by **two** consumers and must stay a non-empty,
in-vocabulary array whenever size is required:

1. `taxonomy.validateItem` (`backend/src/services/taxonomy.service.js:88-103`) —
   required check + locked-dropdown check. A drifted value = 422 on save.
2. The follower-app size filter — `facets.size` drives the browse filter chips
   (`listing.controller.js:472-506`).

Per-colour lists are always a **subset** of the master list, so the union is
always in-vocabulary. Storing the union (not the master) prevents advertising a
size that no colour actually stocks.
