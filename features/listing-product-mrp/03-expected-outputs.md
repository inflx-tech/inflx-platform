# Expected outputs

## Create — batch item + persistence
`POST /brands/me/products/batch` item may include `mrp`:
```json
{ "name": "Biba Kurta", "price": 1499, "mrp": 1999, "facets": { "size": ["M"] } }
```
`insertProducts` writes `brand_products.mrp = 1999` (was always null before).
Blank/absent → null.

## Edit — PATCH semantics
`PATCH /brands/me/listing-products/:id`:
- `"mrp": 1999` → set to 1999
- `"mrp": null` (or `""`) → cleared to null
- key absent → existing mrp preserved

## Excel template
```
Name * | Price * | MRP | Brand | Description | Stock | <facets…> | …
```
- MRP optional, numeric (Instructions sheet says "A number.").
- `buildItems` maps `MRP` → `item.mrp`.

## UI
- Basics step: **MRP ₹ (optional)** input beside Price (add + edit).
- Review step: price shown with MRP struck-through when `mrp > price`.
- Inventory rows already render the strike-through (`mrp > price`) — unchanged.
