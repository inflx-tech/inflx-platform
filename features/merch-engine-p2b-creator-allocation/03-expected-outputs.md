# Expected Outputs — Creator store auto-fills from live allocation

> Step 3 (cont.). Backend-only.

## Per-step expected outputs
| Step | Observable output | How QA verifies |
|---|---|---|
| 1 | brand campaign live with an offer carrying products | seed/setup |
| 2 | `GET /store/:handle` → offer's `products[]` populated from allocation | API: products length > 0, IDs == allocated active products |
| 3 | a noted product carries `influencer_note`; others `null` | API per-product `influencer_note` |
| 4 | offer with no allocated products → `products: []`, offer still present | API assertion |

## Data assertions (post-workflow)
- `offers[].products[]` == active products whose IDs come from the offer's config (`products`/`d_prods`/`v_prods`/`bnd_prods`/bogo/free_gift) ∪ set `products_json`.
- No reliance on `influencer_product_notes` for visibility (notes only annotate).
- Inactive products excluded; malformed config → empty, no error.
- No money / attribution / schema change (4-ID tracking per offer unchanged).

## Visual evidence required
- network: `GET /store/:handle` response showing populated `products[]` per live offer (vs the old empty "still curating").
- (No UI mockup — backend-only contract; the mobile creator store already renders `offers[].products[]`.)
