# Expected outputs

## Stepper batch item
`POST /brands/me/products/batch` item now includes `description`:
```json
{
  "category_node_id": "uuid-leaf",
  "items": [
    {
      "name": "Biba Kurta",
      "price": 1499,
      "brand": "Biba",
      "description": "Straight-cut cotton kurta, breathable for daily wear. Machine wash cold.",
      "stock": 20,
      "facets": { "color_tone": ["Maroon"], "size": ["M","L"] }
    }
  ]
}
```
Persisted to `brand_products.description` (was always `null` before).

## Excel template
Generated template columns (leaf with variants):
```
Name * | Price * | Brand | Description | Stock | <facets…> | Colour * | Size | Variant stock | Cover image URLs | Colour image URLs
```
- Description is optional (no `*`), free text, documented on the Instructions sheet.
- `buildItems` maps the `Description` cell → `item.description`.

## UI
- Basics step shows an optional Description textarea (min 72px, vertical resize).
- Review step renders the description under name + price when present.
- No change to required-field validation — description is always optional.
