# Workflow Definition — Rule builder depth

## Actor
Admin in the App Builder wizard (My rule tab) / Section Library page.

## Preconditions
P1–P3 live locally; gated products exist in the dev DB (fashion world);
at least one product with a facets.brand and tagged products.

## Workflow steps
1. Wizard → Deals/Product shelf → **My rule → Build a new rule** shows three
   new controls: **Brand**, **Exclude tags**, **Hand-pick products**.
2. Type a brand → Check matches → count reflects only that brand's items;
   PUT/library save round-trips `brand` (no longer stripped).
3. Toggle an exclude tag → matches drop accordingly; saved rule carries
   `exclude_tags`.
4. Hand-pick: type in the search box → gated products listed (name/price/
   brand) → pick 3 → they appear as an ORDERED list (remove ✕) → Check
   matches → count = 3 → publish → follower payload returns exactly those 3
   **in the admin's order**.
5. Preview endpoint: POST /admin/section-library/preview with each new key →
   200 + correct counts; invalid shapes (product_ids not an array, >50 ids)
   → 422 with message.
6. Section Library page shows the same three controls; opening + saving an
   existing simple rule there does NOT strip anything.
7. Regression: existing library rules (tags/price/offer) unchanged —
   pre-existing "Food under 400" placement still returns the same items;
   pnpm qa 79/79.

## Success definition
All three intents expressible from both surfaces, round-tripping through
validateRule, honored by the engine (order included), zero regression.

## Failure / edge workflows
- product_ids referencing an unpushed/inactive product → engine's existing
  gates exclude it (count < picked; preview shows the truth).
- Search with no matches → "no products found" empty state.
- brand with zero matches → honest 0 count (rule still saveable).
