# Workflow — MRP field

## Add (one-by-one)
1. Basics step now shows **Price ₹ \*** and, beside it, optional **MRP ₹**.
2. Brand enters MRP (e.g. 1999) higher than price (1499).
3. Review shows `₹1499` with `₹1999` struck through.
4. Save → item carries `mrp` → `insertProducts` writes `brand_products.mrp`.
5. Inventory / storefront show the strike-through (existing render, `mrp > price`).

## Edit
1. `?edit=<id>` pre-fills MRP from the product.
2. Brand changes or clears MRP.
   - Changed → new value saved.
   - Cleared → `mrp` set to null (strike-through disappears).
   - Untouched → preserved.
3. Save changes → `PATCH /brands/me/listing-products/:id`.

## Excel bulk
1. Template includes an optional **MRP** column (documented as a number on the
   Instructions sheet).
2. Filled MRP imports into `brand_products.mrp`; blank → null.

## Edge cases
- MRP ≤ price → stored, but no strike-through renders (UI guards on `mrp > price`).
- Blank MRP → null (unchanged behaviour for products without a discount).
