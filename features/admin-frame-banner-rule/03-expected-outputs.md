# 03 — Expected outputs

## Stored tile (config_json.tiles[i])
```json
{ "image_url": "…", "label": "Adidas deals",
  "rule_json": { "brand": "Adidas", "min_discount_pct": 40, "business_type": "fashion" } }
```
Another: `{ "label": "Under ₹99", "rule_json": { "price_max": 99, "business_type": "fashion" } }`

## Tap → GET /follower/section-results?rule=library_products&rule_json=…
- `ruleDef` = the parsed rule_json; `sectionBusinessType` = rule_json.business_type.
- `libraryProducts` applies the conditions incl. the new brand clause:
  `lower(facets->>'brand') = lower($brand) OR (facets->'brand') ?| ARRAY[$brand]`.
- Returns `{ items:[…products…], item_type:'products', capped }`.

## Verified examples (prod demo data)
- `{brand:'Nike', min_discount_pct:40}` → Nike T-Shirts ≥40% off.
- `{price_max:1000}` → products under ₹1000 in the world.
- `{}` (empty) → wired group / scoped-world fallback.
