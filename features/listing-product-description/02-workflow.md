# Workflow — Product description field

## One-by-one stepper
1. Brand drills to a leaf → **Add one-by-one** → Step 1 (Basics).
2. Below name / brand / price / stock / SKU, an optional **Description** textarea.
3. Brand types a description (or leaves it blank).
4. Continues through Variants / Details → **Review** shows the description under
   the name + price.
5. On **Add this item**, the batch item carries `description`. On **Save all**,
   `POST /brands/me/products/batch` → `insertProducts` writes it to
   `brand_products.description`.
6. The description then appears wherever product copy is shown (inventory rows,
   storefront, etc.).

## Excel bulk
1. Brand downloads the per-leaf template — it now includes a **Description** column
   (optional, free text; documented on the Instructions sheet).
2. Brand fills descriptions per product (first row of each name-group wins, same as
   Brand/Stock).
3. Upload → `buildItems` reads `Description` into `item.description` → same
   validate + `insertProducts` path persists it.

## Edge cases
- Blank description → `null` (unchanged from today).
- Bulk: a missing Description column is fine (optional) — no stale-template error.
- Multi-row variant products: description taken from the group's first row.
