# Workflow — Edit a listed drill-down product

## Happy path
1. Brand opens inventory (either browse path) and taps **Edit** on a product row.
2. Browser navigates to `/dashboard/products/listing?edit=<productId>`.
3. The page loads the product via `GET /brands/me/listing-products/:id` → sets the
   stepper's leaf + facet schema + a draft pre-filled from the product:
   - cover photos from `facets._images` (or variants_json.cover_images / image_url)
   - name, price, brand (`facets.brand`), stock, description
   - facet values from `facets`
   - per-colour photos + per-size stock from `variants_json.colors`
4. The brand edits across the same steps — Basics (photos/name/brand/price/stock/
   description) · Variants (colours/sizes + per-colour pics & stock) · Details
   (facets) · Review.
5. On **Save changes**, `PATCH /brands/me/listing-products/:id` validates with the
   same `taxonomy.validateItem` as create, rebuilds facets/variants/cover, and
   updates the row. Brand is returned to **My listings**.

## What edit mode hides / changes vs add
- Top tabs (My listings / Add products), the category tree grid, the bulk-Excel
  tab, and the staged-items list are hidden.
- Step-1 Back becomes **Cancel** (returns to the listing page).
- Step-4 primary becomes **Save changes** (PATCH) instead of **Add this item**.

## Validation / edge cases
- Required facets (e.g. Size when the leaf requires it) must remain filled — same
  rules as create; Save is blocked with the same inline hints.
- The leaf + SKU never change on edit.
- A product with no `category_node_id` (not a drill-down listing) → PATCH 422.
- Load failure → inline error; the brand can go back.
- Brand typed into the datalist is captured into `listing_brands` (flywheel),
  same as create.

## Reuse guarantee
Create and edit share `taxonomy.validateItem`, `buildVariants`, and `coverImage`, so
an edit can never write a shape the create path wouldn't.
