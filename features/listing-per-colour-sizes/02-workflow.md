# 02 — Workflow

## Actor
Brand user, approved, fashion vertical, on `/dashboard/products/listing?tab=add`,
drilled to a leaf whose `size_system` is NOT free/one-size/unstitched
(e.g. `Men › Topwear › T-Shirt`, `size_system = alpha`).

## Happy path — differing sizes per colour

1. Step ① — enter name, price. Press **Next**.
2. Step ② — tap **Colour / Tone**: `White`, `Blue`.
3. Step ② — tap **Size**: `S`, `M`, `L`.
   → This is the product's full range. It feeds `facets.size`.
4. Two colour cards render. **Each already shows S, M, L switched on** with an
   empty stock box beside each. Nothing extra to click.
5. White card — upload photos, enter stock S=5, M=8, L=5.
6. Blue card — tap **S** to switch it off. The stock box for S is replaced by a
   dash. Enter stock M=6, L=4.
7. Press **Next** → Step ③ details → Step ④ review → **+ Add this item**.
8. **Save all 1 product**.

### End state (the assertion)

`brand_products.variants_json`:

```json
{ "sku": "VAST-0001",
  "cover_images": [],
  "colors": [
    { "color": "White", "images": ["…"],
      "sizes": [ {"size":"S","stock":5,"sku":"VAST-0001-WHI-S"},
                 {"size":"M","stock":8,"sku":"VAST-0001-WHI-M"},
                 {"size":"L","stock":5,"sku":"VAST-0001-WHI-L"} ] },
    { "color": "Blue", "images": ["…"],
      "sizes": [ {"size":"M","stock":6,"sku":"VAST-0001-BLU-M"},
                 {"size":"L","stock":4,"sku":"VAST-0001-BLU-L"} ] } ] }
```

`brand_products.facets.size` = `["S","M","L"]` (union — S survives because White
stocks it).

**Blue/S does not exist as a sellable sub-SKU.** That is the whole point.

## Round-trip

9. Inventory → open that product → **Edit**.
10. Step ② renders White with S/M/L on, Blue with S **off** and M/L on, stock
    values populated. Save with no edits → identical `variants_json`.

## Guarded paths

- **Every size off for a colour** — Next disabled, hint reads
  `Pick at least one size for Blue.`
- **Global size removed after per-colour edit** — untick `L` at the top; `L`
  disappears from both colour cards. Per-colour lists are filtered through the
  master list on read, so a stale entry can never resurface.
- **Free-size leaf** (`Women › Ethnic Wear › Saree`) — no size row at all; colour
  cards show photos only. Untouched.
- **No colours selected** — single product-photo set, no colour cards. Untouched.

## Regression surface
`pnpm qa` (brand-web + API lanes). Excel import path must remain green and is not
touched by this change.
