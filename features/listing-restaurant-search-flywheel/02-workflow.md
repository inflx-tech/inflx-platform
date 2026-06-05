# Workflow Definition — Restaurant dish search + custom-name flywheel

> Step 3. Each numbered step becomes a Playwright/jest assertion. Real
> user behaviour; "page rendered" is NOT success. Grounded in the real
> code: `RestaurantDishPicker.js` (brand-web step-4), `GET
> /brands/me/master-catalogue`, `POST /brands/me/products`,
> `adminMasterDish.controller.js`.

This contract has **three workflows** under one feature: A (seller search + custom add), B (admin queue resolve), C (flywheel promotion logic). A and B are Playwright; C is a pure-function/DB assertion.

---

## Workflow A — Seller searches a dish and adds a custom one

### Actor
Authenticated **brand**, role=brand, `status=approved`, `category=restaurant`, on brand-web `/dashboard/products` → listing wizard → "Add your menu" step → **Add individually** path.

### Preconditions (test-seeded, deterministic)
- `localStorage.inflx_user = { role:'brand', status:'approved', category:'restaurant' }`, `inflx_token='qa-brand'` via `addInitScript` before app JS.
- Stubs:
  - `GET **/brands/me/listing-config` → restaurant, `listing_engine_active:true`, cuisines incl. `["South Indian"]`.
  - `GET **/brands/me/master-catalogue` → existing dish list (unchanged behaviour).
  - **NEW** `GET **/brands/me/dishes/search?q=perugu*` → `{ success:true, data:{ matches:[{ id:'md_dahivada', name:'Dahi Vada', section:'Tiffins', score:0.86 }], allow_custom:true } }`
  - `POST **/brands/me/products` → `{ success:true, data:{ id:'bp_new', name:'Perugu Vada', master_dish_id:null, pending:true } }`

### Workflow steps (user-observable)
1. Seller is on **Add dishes** (Individual path). A **search box** "Search or type a dish…" is visible at the top of the picker (NEW; sits above the cuisine/section browse, which still works).
2. Seller types **"Perugu Vada"** → `GET /brands/me/dishes/search?q=Perugu%20Vada` fires (debounced) → a dropdown shows the fuzzy match **"Dahi Vada · looks similar (86%)"** AND a persistent option **"➕ Add 'Perugu Vada' as your own dish"**.
3. Seller clicks **"➕ Add 'Perugu Vada' as your own dish"** → the item is added to the dish list with the name **kept verbatim "Perugu Vada"** and an editable price; a small **"New · pending review"** chip appears on it.
4. Seller sets price and the wizard saves → `POST /brands/me/products` fires with body `{ name:'Perugu Vada', master_dish_id:null, section:…, price:… }` → the dish is **live immediately**.

### Success definition
SUCCESSFUL only if: (a) the search box rendered and the typed query issued `GET …/dishes/search`, (b) BOTH a fuzzy suggestion and the "add as your own" option appeared, (c) choosing custom added an item whose displayed name is **exactly "Perugu Vada"** (verbatim, not "Dahi Vada"), and (d) save issued `POST /products` with `master_dish_id:null`. Any blocking of the custom dish, or silent rename to the canonical, is a FAILURE.

### Failure / edge workflows (same contract)
- **Suggestion picked instead:** clicking "Dahi Vada" adds the item linked to `master_dish_id:'md_dahivada'` (canonical), display name = "Dahi Vada"; no pending chip.
- **No match at all** (`matches:[]`): only the "add as your own" option shows; custom add still works, still live.
- **Not approved:** `POST /products` returns 403 (`requireApproved`) → inline error, no live dish. (Guard.)
- **Search endpoint 500 / pg_trgm absent:** picker degrades to the existing browse grid; custom-add still available. No hard failure.

---

## Workflow B — Admin resolves the pending-dish queue

### Actor
Authenticated **admin**, `admin_role` ≥ reviewer, on admin-web `/admin/dish-queue`.

### Preconditions (test-seeded)
- Admin session seeded (per `admin-approvals` pattern).
- Stubs:
  - **NEW** `GET **/admin/dish-queue` → `{ success:true, data:{ items:[{ id:'pd_1', raw_name:'Perugu Vada', restaurant_count:3, suggested:{ master_dish_id:'md_dahivada', name:'Dahi Vada', score:0.86 } }] } }`
  - **NEW** `PATCH **/admin/dish-queue/pd_1` → `{ success:true, data:{ id:'pd_1', status:'alias', linked_listings:3 } }`

### Workflow steps (user-observable)
1. Admin opens `/admin/dish-queue` → **"Dish Review Queue"** heading + the row **"Perugu Vada"** with badge **"seen at 3 restaurants"** and suggestion **"Dahi Vada (86%)"**, plus three actions: **Link as alias · Promote to new dish · Reject**.
2. Admin clicks **Link as alias** → `PATCH /admin/dish-queue/pd_1` body `{ action:'alias', master_dish_id:'md_dahivada' }`.
3. On success → toast **"Linked — 3 listings now point to Dahi Vada"**, row leaves the queue.

### Success definition
SUCCESSFUL only if: queue rendered (not redirected to /login), the PATCH fired with `{action:'alias', master_dish_id:'md_dahivada'}`, and the success toast appeared. 

### Failure / edge workflows
- **Promote to new dish:** PATCH `{ action:'promote' }` → new `master_dishes` row created, `pending_dishes.status='promoted'`.
- **Reject:** PATCH `{ action:'reject' }` → `status='rejected'`, listings keep their custom names, item stays a one-off.
- **No admin session:** `/admin/dish-queue` redirects to `/login`, `GET /admin/dish-queue` never called.

---

## Workflow C — Flywheel auto-promotion (pure logic + DB)

### Trigger
A periodic job (or the queue-resolve path) evaluates `pending_dishes` grouped by normalized `raw_name`.

### Rule (deterministic, unit-testable)
- Given N independent restaurants with the same normalized custom name and no confident master match, when **N ≥ `PROMOTE_THRESHOLD` (default 5)**, the group is **flagged `auto_promote_candidate`** (v1 = surfaced at top of admin queue; NOT silently written to `master_dishes`).
- Normalization = `unaccent(lower(trim(raw_name)))` collapse of whitespace.

### Success definition
The promotion function, given a fixture of 5 restaurants with "perugu vada" and a 6th with "pongal", returns exactly one candidate (`perugu vada`, count 5) and not "pongal" (count 1). Pure function, no network.
