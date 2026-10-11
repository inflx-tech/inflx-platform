# Expected Outputs — A photo save must never put sold stock back

> Step numbers are those of `02-workflow.md`. "Compiles" is NOT an expected output.
> All in `backend/tests/cover-photo-keeps-stock.test.js` — real API, real database, the real
> stock movement an order makes (`stock.service.moveProducts`).

| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 1 | 3–4 | An order's movement (M 3 → 2) is held open; the photo save is sent and is seen waiting; the order commits; the photo save answers 200. After: M = 2, the own number = the total of the sizes, the photo is in `cover_images` and is the cover | API + database; **fails on today's code** (M back to 3, own number ≠ total) |
| 2 | 3–4 | The other direction: a piece that comes back (a cancelled order, L 4 → 6) while a photo save waits is still back afterwards | API + database; **fails on today's code** (L back to 4) |
| 3 | 3, 5 | Behaviour kept: photos are added after the ones there, 6 at most, the first is the cover; the answer is `{ id, image_url, cover_images }` | API |
| 4 | edges | A product of another brand: 404. No `urls`: 422. A record stored as text: the photo is saved and the colours are still readable | API + database |
| 5 | 6 | `PATCH /brands/me/products/:pid` with `{ stock: 99 }` while an order's movement is held open: after both, the own number = the total of the sizes | API + database; **fails on today's code** |
| 6 | 7 | The same endpoint with only `is_active` or `price` is not changed: Hide, Show and a new price answer as before | the existing suites (`listing-shop-safety`, `stock-asked-once`, `shoppable-posts-v2`) stay green |

## Regression gates
- `backend`: the full suite, serial, against `backend/baseline_listing_shop_safety.json` — 0 newly failing.
- No website or phone code is touched: their suites are not re-run.
