# 06-diff notes — Phase 3d (offer/discount section rules)

Implemented to the locked mockup (`04-preview/mockups/offer-discount-rule.html`).

## What was implemented
- **`sectionLibrary.validateRule`**: accepts `has_offer` (bool, only when true) +
  `min_discount_pct` (number, coerced, clamped 0–100, rejects negative).
- **`sectionRules.libraryProducts`**: two optional correlated-EXISTS clauses over
  `brand_offers` (live gate: status='active' + published_to_store + temporal window):
  - **has_offer** → an applicable offer of any type exists.
  - **min_discount_pct** → an applicable `offer_type='discount'` offer with computed pct ≥ X
    (`pct` → value; `flat` → value/price*100, guarded against price 0 + non-numeric via regex).
  - **applies-to-product**: effective scope (`config.scope` else products-present?'products':'store')
    → store-wide applies to all the brand's products; category → `bp.section` match; products →
    `bp.id` in `offer_config_json.products[]`.
- **Builder UI** (`app/admin/section-library/page.js`): an "Offers" block with a
  "live offer" toggle + "Minimum discount %" input → into the rule + debounced preview;
  list-view chips for `≥X% off` / `has offer`.
- Extended the validation unit test.

## Verified
- `node --check` + validateRule smoke; brand-web build exit 0; **pnpm qa 79/79 GREEN gate 0**.
- **SQL validated against real prod data (read-only)**: `has_offer + ≥10%` returned 4 real
  products with live store offers — no syntax error, correct results (fashion currently 0).

## Mockup → build: matches
- The two controls + preview behavior + the gating/store-wide semantics match the mockup.

## What to check in prod (founder)
- Section Library → New/Edit a Fashion section → set "Minimum discount % = 20" → preview count
  reflects only products under a live ≥20% store offer (publish a fashion offer to test).
- Toggle "live offer" → any-offer products. Both stack with category/tags/price + context.
