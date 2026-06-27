# 03 — Expected outputs (Slice A)

## `GET /follower/cart-recommendations?product_ids=a,b&limit=8`
- Resolves the cart products' `section`s, returns live (approved · is_active ·
  pushed_to_store) products in those sections, **excluding** the cart ids, ordered by
  MRP-markdown desc then newest. Capped at `limit` (≤20).
- Item shape: `{ entity_type:'product', id, name, price, mrp, discount_value, image_url,
  section, brand:{id,name,category} }`.
- No cart sections / no ids → `{ items: [] }`.

## CartScreen
- Fetches recommendations from the cart's `product_id`s (refetch when the cart changes).
- Renders a horizontal "You might also like" rail (image · name · price · struck MRP).
- Tap → `ProductDetail` (organic).
