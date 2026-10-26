# Expected outputs

Each row is a test in `backend/tests/product-approval-switch.test.js`. Real API, real database.

## The switch off (today)

| # | Do | Expect |
|---|---|---|
| E1 | `GET /admin/platform-settings` | `product_approval_required` present, value 0, `kind: 'switch'` |
| E2 | brand `POST /brands/me/products` | `pushed_to_store: true`, `approval_status: 'approved'`; brandProducts.service lists it as published |
| E3 | brand `POST /brands/me/products/batch` (two items) | both `pushed_to_store: true`, `approved` |

## The switch on

| # | Do | Expect |
|---|---|---|
| E4 | admin `PATCH /admin/platform-settings { product_approval_required: 1 }` | 200, audit row 0 → 1 |
| E5 | brand `POST /brands/me/products` | 201; `pushed_to_store: false`, `approval_status: 'pending'`, `approval_requested_at` set; `approval: { waiting: true }` on the response |
| E6 | brand batch create (two items) | both pending, both not pushed |
| E7 | the pending product | NOT in `GET /brands/:id/store` for a shopper, NOT in a creator's product list (brandProducts.service), NOT in `GET /listing/nodes/:leaf/products` |
| E8 | `GET /admin/products?status=pending` | lists it with brand name, price, image, leaf name, `approval_requested_at`; `counts.pending` = 3 |
| E9 | `GET /admin/stats` | `pending_products: 3` |
| E10 | admin `POST /admin/products/:id/approve` | 200; `pushed_to_store: true`, `approved`, `approval_decided_by` = admin, `approval_decided_at` set, note null; brand user gets a `product.approved` notification naming the product; it is now in the store |
| E11 | admin `POST /admin/products/:id/reject` without reason | 422 VALIDATION_ERROR, field `reason` |
| E12 | admin reject with reason | 200; `rejected`, `approval_note` = reason, still not pushed; brand gets `product.rejected` with the reason |
| E13 | brand `PATCH … { pushed_to_store: true }` on the rejected product | 200; `pending` again, `approval_note` cleared, still not pushed; `approval.waiting: true` |
| E14 | brand `PATCH … { pushed_to_store: false }` on a pending product | 200; `withdrawn`, not in the admin pending list |
| E15 | brand `PATCH … { pushed_to_store: true }` on the withdrawn one | `pending` again |
| E16 | approve, then brand hides (`pushed_to_store: false`) and shows again | goes live at once, stays `approved`, never re-enters the queue |
| E17 | admin approve on a product that is not pending (already approved) | 404 NOT_FOUND |
| E18 | a product listed while the switch was OFF, then the switch turned ON | still live, still `approved` |
| E19 | a creator holds the product (signed store terms) and admin approves | the creator is told *back on sale* (creatorTerms.afterProductChange runs) |

## The switch turned off with products waiting

| # | Do | Expect |
|---|---|---|
| E20 | two pending, one rejected, one withdrawn; admin sets the switch to 0 | the two pending become `approved` and `pushed_to_store: true` with note `released: approval switched off`; the rejected and withdrawn ones are untouched; response `released: 2` |
| E21 | after that, brand publishes | immediate, `approved` |

## Guards

| # | Do | Expect |
|---|---|---|
| E22 | a reviewer admin (capability approvals) | can list and decide; an admin without it gets 403 |
| E23 | `settings.get` read fails | the gate treats the switch as OFF — a settings outage never blocks a brand's publish (the safe side here is the one that keeps today's behaviour) |
| E24 | a second brand's product | admin list shows both brands; the decision endpoint works across brands |

## Web (checked by reading, listed in 06-diff/notes.md)

| # | Where | Expect |
|---|---|---|
| W1 | Admin → Settings → Platform | the switch row with its description; confirm when turning off |
| W2 | Admin sidebar | **Product Queue** with the waiting badge |
| W3 | Admin → Approvals | a Products tile and card linking to the queue |
| W4 | Admin → Product Queue | three tabs, Approve / Send back with a required reason |
| W5 | Brand → Products (fleet row) | *Waiting for INFLX approval* / *Sent back: reason* pills; the toggle still works |
| W6 | Brand → Products (standard row) | the same pills |
| W7 | Wizard finish | *Sent to INFLX for approval* when every created product is waiting |
