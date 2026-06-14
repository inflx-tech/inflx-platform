# Workflow Definition — Product push-to-store + brand-store gate

> Step 3. Each step becomes a QA assertion.

## Actor
(A) logged-in **brand**, approved, with several active products. (B) **follower** opening that brand's store.

## Preconditions
- Brand has ≥3 active products. On deploy all default `pushed_to_store = true`.

## Workflow steps (user-observable)
1. **Follower** opens the brand store before any change → sees **all** the brand's active products (parity — default pushed=true).
2. **Brand** opens its product list → each product shows a **"Show in store"** toggle, all ON by default.
3. **Brand** turns **OFF** "Show in store" on one product → saved (`pushed_to_store=false`).
4. **Follower** reopens the brand store → that product is **gone**; the rest remain.
5. **Brand** turns it back **ON** → follower store shows it again.
6. **Brand** creates a NEW product → it is `pushed_to_store=true` by default (decision A) and appears in the store.

## Success definition
- Brand store returns exactly the brand's `is_active=true AND pushed_to_store=true` products.
- Toggling the flag adds/removes the product from the follower brand store with no other effect (listing, allocation, links untouched).
- On deploy, pre-change brand-store output == today's output (parity).

## Failure / edge workflows
- Brand un-pushes every product → its store is empty (expected, not an error).
- `pushed_to_store` omitted on create → defaults true.
- Non-brand hits the product write → role-gated.
