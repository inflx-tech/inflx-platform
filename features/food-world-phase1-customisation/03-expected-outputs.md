# Expected Outputs — Food World Phase 1

## Migration 113 (DB)
- `product_addon_groups` table: id, product_id (FK→brand_products CASCADE),
  name, selection_type ('single'|'multi'), is_variation bool, is_required bool,
  min_select int, max_select int (nullable), sort_order int, timestamps.
- `product_addon_items` table: id, group_id (FK→product_addon_groups CASCADE),
  name, price numeric(10,2), source_product_id (nullable FK→brand_products),
  is_default bool, is_active bool, sort_order int, created_at.
- `brand_products` + `badge text`, `is_featured boolean default false`,
  `featured_sort int default 0`.
- Indexes: (product_id, sort_order) on groups; (group_id, sort_order) on items;
  partial (brand_id, featured_sort) where is_featured.

## getProductDetail response
```json
{ "product": {
  "id":"…","name":"Paneer Curry","price":114, "...":"…",
  "addon_groups":[
    {"id":"…","name":"Accompaniment","selection_type":"multi",
     "is_variation":false,"is_required":false,"min_select":0,"max_select":2,
     "sort_order":0,"items":[
       {"id":"…","name":"Roti","price":15,"is_default":false,"sort_order":0},
       {"id":"…","name":"Coke","price":40,"is_default":false,"sort_order":1}]},
    {"id":"…","name":"Portion","selection_type":"single","is_variation":true,
     "is_required":true,"min_select":1,"max_select":1,"sort_order":1,"items":[
       {"id":"…","name":"Full","price":114,"is_default":true,"sort_order":0},
       {"id":"…","name":"Half","price":70,"is_default":false,"sort_order":1}]}
  ]}}
```
- A dish with no groups → `"addon_groups": []`.

## Section payload item (additions)
`rating` (number|null), `review_count` (int), `badge` (string|null),
`has_addons` (bool) — alongside existing id/name/price/image_url/etc.

## Storefront brand block (additions)
`free_delivery` (bool), `delivery_eta_min_mins` (int|null),
`delivery_eta_max_mins` (int|null).

## Order
- placeOrder with variation Half + add-on Coke → line unit price 110.
- verifyOrder → `follower_orders.items_json[n]` =
  `{product_id, variant_id, variant_sku, variant_label, quantity,
    price:110, variation:{group_id,item_id,name:"Half",price:70},
    selected_addons:[{group_id,item_id,name:"Coke",price:40}],
    note:"extra spicy"}`.

## QA
`pnpm qa` GREEN (66), zero regression. Non-customised order totals unchanged.
