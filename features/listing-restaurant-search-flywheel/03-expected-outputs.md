# Expected Outputs — Restaurant dish search + custom-name flywheel

> Step 3 (cont.). What the QA report asserts. Defined BEFORE code.

## Per-step expected outputs

### Workflow A (seller search + custom add) — Playwright `qa/web/brand/restaurant-dish-search.spec.ts`
| Step | Observable output | How QA verifies |
|---|---|---|
| A1 | Search box placeholder "Search or type a dish…" visible above the browse grid | `getByPlaceholder(/search or type a dish/i)` |
| A2 | Typing "Perugu Vada" issues `GET /brands/me/dishes/search?q=` ; dropdown shows "Dahi Vada" (86%) **and** "Add 'Perugu Vada' as your own dish" | route captured; `getByText(/Dahi Vada/)` + `getByText(/add 'Perugu Vada'/i)` |
| A3 | Item added with name text exactly "Perugu Vada"; "New · pending review" chip visible | `getByText('Perugu Vada')` exact; `getByText(/pending review/i)` |
| A4 | Save fires `POST /brands/me/products` body `{ name:'Perugu Vada', master_dish_id:null }` | route handler captures body; assert `name` verbatim + `master_dish_id===null` |

### Workflow B (admin queue) — Playwright `qa/web/admin/dish-queue.spec.ts`
| Step | Observable output | How QA verifies |
|---|---|---|
| B1 | "Dish Review Queue" heading; row "Perugu Vada" + "seen at 3 restaurants" + "Dahi Vada (86%)" + 3 action buttons | `getByRole('heading',{name:/dish review queue/i})`; `getByText(/seen at 3/i)` |
| B2 | Click "Link as alias" → `PATCH /admin/dish-queue/pd_1` body `{action:'alias',master_dish_id:'md_dahivada'}` | route captures body; assert action+id |
| B3 | Toast "Linked — 3 listings now point to Dahi Vada"; row removed | `getByText(/3 listings now point to/i)` |

### Workflow C (promotion logic) — jest `qa/backend/dish-promotion.test.js`
| Step | Observable output | How QA verifies |
|---|---|---|
| C1 | `findPromotionCandidates(fixture)` → `[{ name:'perugu vada', count:5 }]`, excludes count-1 names | unit assertion on returned array |

## Data assertions (post-workflow)
- **Custom add (A):** one `brand_products` row, `name='Perugu Vada'` (verbatim), `master_dish_id IS NULL`; one `pending_dishes` row `{ raw_name:'Perugu Vada', status:'pending', brand_product_id=<that row> }`.
- **Suggestion path:** `brand_products.master_dish_id='md_dahivada'`; NO `pending_dishes` row.
- **Alias resolve (B):** one `dish_aliases` row `{ master_dish_id:'md_dahivada', alias_text:'Perugu Vada' }`; `pending_dishes.status='alias'`; the 3 affected `brand_products` resolve to canonical via alias (display names unchanged).
- **Search ranking:** `GET /dishes/search?q=` orders by trigram similarity then `master_dishes.popularity_rank` (assert a higher-popularity exact-ish match ranks above a lower one in a seeded DB test).
- Money: prices remain rupees `numeric`; no paise.
- No campaign/attribution IDs involved (listing-only).

## Negative / edge expected outputs
- No-match query: only "add as your own" offered; custom product still created + live.
- Unapproved brand `POST /products` → 403 `{error.code:'FORBIDDEN'}`; no row.
- `pg_trgm`/`unaccent` not installed: search falls back to `ILIKE`; no 500. (Prod migration enables both — assert extensions present in `qa:db` lane.)
- No admin session on `/admin/dish-queue` → redirect `/login`, `GET /admin/dish-queue` NOT called.

## Visual evidence required
- before: `qa/artifacts/screenshots/before/dish-search__browse-only.png` (current browse-only picker)
- after: `qa/artifacts/screenshots/after/dish-search__typeahead-custom.png` (search box + custom option), `after/dish-queue__resolve.png` (admin queue)
- network: `GET /brands/me/dishes/search` and `POST /brands/me/products` must be observed in A; `PATCH /admin/dish-queue/:id` in B.

## Implemented by (after lock)
- `qa/web/brand/restaurant-dish-search.spec.ts`, `qa/web/admin/dish-queue.spec.ts`, `qa/backend/dish-promotion.test.js` (created in Step 7) — all green in `qa/reports/latest.md`.
- `qa:db` lane: migration installs `pg_trgm`+`unaccent`, creates `pending_dishes`+`dish_aliases`, adds `master_dishes.popularity_rank`.
