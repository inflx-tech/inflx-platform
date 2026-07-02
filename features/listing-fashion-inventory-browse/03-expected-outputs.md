# Expected outputs

## `GET /brands/me/listing-tree`
```json
{
  "success": true,
  "data": {
    "vertical": "fashion",
    "tree": [
      {
        "id": "uuid-women",
        "name": "Women",
        "segment": "Women",
        "depth": 0,
        "is_leaf": false,
        "product_count": 186,
        "children": [
          {
            "id": "uuid-women-footwear",
            "name": "Footwear",
            "depth": 1,
            "is_leaf": false,
            "product_count": 41,
            "children": [
              { "id": "uuid-heels", "name": "Heels", "is_leaf": true, "product_count": 16, "children": [] }
            ]
          }
        ]
      }
    ]
  }
}
```
- `product_count` on a leaf = the brand's products directly under it (any status).
- `product_count` on a branch = sum of descendant leaf counts.
- Nodes the brand hasn't listed in still appear with `product_count: 0`; the UI
  hides those in the browse.

## `GET /brands/me/listing-nodes/:id/products`
```json
{
  "success": true,
  "data": {
    "node": { "id": "uuid-heels", "name": "Heels", "segment": "Women", "category": "Footwear", "is_leaf": true },
    "products": [
      {
        "id": "uuid-p1", "name": "Strappy Block Heels", "price": 1499, "mrp": 1999,
        "image_url": "https://…", "sku": "FA-HEEL-0007", "stock": 12,
        "is_active": true, "pushed_to_store": true,
        "facets": { "color_tone": ["Black","Tan"], "size": ["36","37","38"] },
        "variants_json": "[]", "category_node_id": "uuid-heels",
        "leaf_name": "Heels", "segment": "Women", "category": "Footwear",
        "created_at": "2026-06-30T10:00:00.000Z"
      }
    ]
  }
}
```
- Products scoped to the calling brand only; other brands never appear.
- All statuses returned; `is_active:false` rows render with a Hidden pill.
- Order: live first, then most-recent.

## UI
- **My listings** tab renders folder tiles (count badge) → drill to leaf → rows.
- Only folders with `product_count > 0` show.
- Row actions Hide/Show + Remove call the existing brand product endpoints and
  re-fetch the leaf.
- Search over name/SKU flattens across the catalogue.
- **Add products** tab is unchanged from current behaviour.
