# 03 — Expected outputs

## GET /listing/nodes/:id/children
```json
{ "success": true, "data": {
  "node": { "id": "…", "parent_id": "…", "vertical": "fashion",
            "segment": "Women", "category": "Footwear", "name": "Footwear",
            "depth": 1, "is_leaf": false },
  "children": [ { "id": "…", "name": "Sneakers / Casual Shoes", "slug": "…",
                  "is_leaf": true, "depth": 2, "sort_order": 5 } ]
} }
```

## GET /listing/nodes/:id/products?f_color=Black,Red&sort=price_asc&page=1
```json
{ "success": true, "data": {
  "node": { "id": "…", "vertical": "fashion", "segment": "Women",
            "category": "Footwear", "name": "Sneakers / Casual Shoes", "is_leaf": true },
  "total": 128, "page": 1, "page_size": 40,
  "items": [ { "entity_type": "product", "id": "…", "name": "…", "price": 1799,
               "mrp": 2999, "discount_value": 40, "image_url": "…",
               "brand": { "id": "…", "name": "…", "category": "fashion" },
               "rating": 4.4, "review_count": 212, "has_addons": false } ],
  "filters": [ { "key": "color", "label": "Color / Tone", "role": "variant",
                 "input_type": "multi_select",
                 "values": [ { "value": "Black", "count": 34 } ] } ],
  "price": { "min": 499, "max": 4999 }
} }
```

## Mobile
- Rail highlights the selected leaf; breadcrumb shows segment › category › leaf.
- Grid = 2-col cards (image, name, brand, price, struck mrp, % off, rating).
- Filters button shows active count; applying re-queries; Clear-all resets.
- Empty/loading states render without crashing; product tap → ProductDetail.
