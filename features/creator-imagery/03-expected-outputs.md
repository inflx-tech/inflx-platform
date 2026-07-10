# Expected Outputs — Asset Pack / Per-context Creator Imagery (Phase 7)

## POST /v1/influencers/me/assets
Body: `{ r2_key:"content/creators/…/street1.jpg", media_type:"image/jpeg", aspect:"landscape" }`
```json
{ "success": true, "data": { "asset": { "id":"as_…", "aspect":"landscape", "status":"pending" } } }
```

## POST /v1/influencers/me/assets/:id/tag-product  { product_id }
```json
{ "success": true, "data": { "product_image": { "id":"cpi_…", "product_id":"p1", "asset_id":"as_…", "status":"pending" } } }
```

## GET /v1/brands/me/creator-images?status=pending  → brand approval queue
```json
{ "success": true, "data": { "images": [
  { "id":"cpi_…", "product":{ "id":"p1","name":"Oversized Tee" },
    "creator":{ "id":"inf_…","handle":"rahul.style" }, "url":"…/street1.jpg", "aspect":"landscape", "status":"pending" }
] } }
```

## POST /v1/brands/me/creator-images/:id/approve|reject → status flips.
## PATCH /v1/brands/me/products/:id/image-source  { influencer_id | null }
`null` → brand's own image; an id → that creator's approved shot shows in the brand store.

## resolveProductImage(product, context) — the contract
| context | flag off | flag on |
|---|---|---|
| `{context:'brand'}` | `product.image_url` | product.display_image_source set + approved shot → that shot; else `product.image_url` |
| `{context:'creator', influencerId}` | `product.image_url` | that creator's approved shot for the product → it; else `product.image_url` |

Never throws → any miss returns `product.image_url`.

## experience render pack (upgraded)
```json
"pack": { "creator_name":"Rahul", "featured_images":[
  { "url":"…/street_landscape.jpg", "aspect":"landscape" },
  { "url":"…/street_portrait.jpg",  "aspect":"portrait" } ],
  "products":[ { "id":"p1","name":"Oversized Tee","image_url":"…/rahul_p1.jpg" } ] }
```
(featured_images = the creator's approved shots; product image_url resolved to the creator's shot in the creator context.)

## Non-goals (must NOT appear)
- Video assets; AI/generated backgrounds.
- Any change to a store when `CREATOR_IMAGERY` flag is off.
