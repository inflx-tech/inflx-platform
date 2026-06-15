# Workflow — Offer/discount section rules (Phase 3d)

## Build order
1. **`sectionLibrary.validateRule`**: accept `has_offer` (bool) + `min_discount_pct`
   (number, clamp 0–100). Keep in the stored rule_json.
2. **`sectionRules.libraryProducts`**: build the brand_offers correlated-EXISTS (live gate +
   effective-scope applies-to-product + discount-pct compute). Add `AND <hasOffer EXISTS>`
   when has_offer; `AND <discount EXISTS ≥X>` when min_discount_pct.
3. **Builder UI** (`app/admin/section-library/page.js`): "Has a live offer" toggle +
   "Minimum discount %" input → into buildRuleJson + the debounced preview.
4. Extend `section-library.test.js` validation cases (has_offer/min_discount_pct).

## Verify
- `node --check` + engine require smoke. `pnpm qa` GREEN gate 0. `pnpm qa:db` validation test passes.
- brand-web build exit 0.
- Manual: build a Fashion section with "Min discount 20%" → preview count reflects only
  products under a live ≥20% store offer; toggle "Has offer" → only products with any live offer.

## Deploy (production-impacting — explicit founder go)
- Push → Render (evaluator) + Vercel (builder). No mobile/OTA/migration. released=false.

## Expected end state
- Admin can add offer/discount filters to a section; the preview + rendered shelf honor them,
  stacking with category/tags/price + surface context.
