# Expected Outputs — Product push-to-store + brand-store gate

> Step 3 (cont.).

## Per-step expected outputs
| Step | Observable output | How QA verifies |
|---|---|---|
| 1 | brand store = all active products (parity) | API snapshot vs pre-change |
| 2 | product list returns `pushed_to_store` (all true) | `GET /brands/me/products` field present |
| 3 | one product `pushed_to_store=false` | DB row + PATCH response |
| 4 | brand store excludes that product | `GET /business/:id` lacks it; count − 1 |
| 5 | brand store includes it again | count restored |
| 6 | new product `pushed_to_store=true`, in store | create response + store includes it |

## Data assertions (post-workflow)
- `brand_products.pushed_to_store`: boolean, default true; backfill = all existing true.
- brand-store query filters `is_active AND pushed_to_store`.
- No money / attribution / allocation fields touched.
- **Parity:** before any un-push, brand-store payload identical to legacy.

## Visual evidence required
- before/after: brand product list with the "Show in store" toggle (on → off); brand store reflecting the change.
- network: `PATCH /brands/me/products/:id {pushed_to_store}`; `GET /business/:id` count change.
