# Before / after — Phase 0 section correctness

## A1 — business-page offers
- **Before:** `screen='business'` deals shelves ran the global offer pool —
  Charvitha's page could show Trendz/Silk Story offers.
- **After:** every offer rule ANDs `b.id = ctx.brandId` (legacy SQL) /
  filters `n.brand.id === ctx.brandId` (V2 `rankForRule`). Home passes no
  brandId → byte-identical (proven by the new unit test's no-brandId case).

## A2 — allocated products respect push state
- **Before:** creator store / preview / creator-scoped `library_products`
  showed allocated products even after the brand un-pushed them
  (`pushed_to_store` skipped by design comment "allocation is its own path").
- **After:** all three reads require `is_active AND pushed_to_store`;
  comments updated to the new policy (list → push → allocate; un-push pulls
  from creator surfaces too). Checkout coupon path untouched.

## B1 — Category browser completable (was: guaranteed 422)
- **Before (screenshot 2026-07-05):** inline editor offered only a world
  select for `type=category`; `category_node_id` had no input anywhere →
  red `config_json.tap_destination.category_node_id required for
  type=category` on every Publish.
- **After:** `CategoryNodePicker` (self-fetching, per-world cache) in the
  wizard destPicker + inline editor + per-tile picker; world change clears
  the node; client-side pre-check blocks finish (step 4) and Publish with
  a plain message naming the section. Wizard option label aligned to
  "Category browser" (was "Category page").

## B2 — schedule guardrail
- **Before:** "Disappears = 11:07 AM today" published silently; section
  vanished minutes later ("Nothing in Fashion yet" confusion).
- **After:** past end → red warning + wizard finish blocked at step 3;
  < 6 h → amber heads-up; inline editor shows both as warnings only.

## Verification
- `backend/tests/brandOffers.adapter.test.js` 26/26 GREEN (new brandId case).
- Full backend jest suite rerun after change (see contract chat / QA report).
- `pnpm qa` GREEN — 79 workflows, gate 0 (2026-07-05T13-51 report).
- JSX parse-checked (esbuild); backend files node --check OK.
