# Expected outputs

## `GET /brands/me/listing-products/:id`
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "uuid", "name": "Biba Kurta", "price": 1499, "mrp": 1999,
      "description": "Straight-cut cotton kurta…", "sku": "CHVW-0007", "stock": 20,
      "image_url": "https://…",
      "variants_json": { "sku": "CHVW-0007", "cover_images": ["https://…"],
        "colors": [ { "color": "Maroon", "images": ["https://…"],
          "sizes": [ { "size": "M", "stock": 8, "sku": "CHVW-0007-MAR-M" } ] } ] },
      "facets": { "brand": "Biba", "_images": ["https://…"],
        "color_tone": ["Maroon"], "size": ["M","L"], "fabric": "Cotton" },
      "category_node_id": "uuid-leaf", "is_active": true, "pushed_to_store": true
    },
    "node": { "id": "uuid-leaf", "vertical": "fashion", "segment": "Women",
      "category": "Ethnic Wear", "name": "Kurta / Kurti", "is_leaf": true,
      "size_system": "alpha", "size_required": true },
    "facets": [ { "facet_key": "color_tone", "facet_role": "variant", "input_type": "multi_select", "…": "…" } ]
  }
}
```
- Brand-scoped: another brand's product → 404.
- Non-drill-down product (no category_node_id) → 422.

## `PATCH /brands/me/listing-products/:id`
Request body = the same item shape the add wizard stages:
```json
{
  "name": "Biba Kurta", "price": 1399, "brand": "Biba", "stock": 25,
  "description": "Updated copy — now with size chart.",
  "images": ["https://cover1","https://cover2"],
  "facets": { "color_tone": ["Maroon","Navy"], "size": ["M","L","XL"], "fabric": "Cotton" },
  "variants": [ { "color": "Maroon", "images": ["https://…"],
    "sizes": [ { "size": "M", "stock": 8 }, { "size": "L", "stock": 5 } ] } ]
}
```
Response: `{ "success": true, "data": { "product": { …updated row… } } }`
- Validated with `taxonomy.validateItem` — invalid facets/missing required → 422
  with the same problem list shape as batch create.
- `facets` rebuilt with `brand` + `_images` re-derived; `variants_json` rebuilt via
  `buildVariants`; `image_url` = `coverImage`. SKU + leaf preserved. MRP preserved
  when not supplied.

## UI
- Inventory rows (both browses) show an **Edit** action → `?edit=<id>`.
- Edit page: header "Edit <Vertical> product"; stepper pre-filled; tabs/tree/bulk/
  staged-list hidden; Save changes / Cancel nav.
- On save → back to My listings with the row reflecting the edit.
