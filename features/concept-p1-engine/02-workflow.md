# Workflow — concept-p1-engine

## W1 — Admin reviews the seeded vocabulary
/admin/concepts → Category tab shows 27 templates in 4 groups; Price 9; Offer
11. Counter shows addressable concepts = active category×leaves +
(price+offer)×(1+leaves) ≈ 9,200 with the 195-leaf tree.

## W2 — Admin previews a concept
Open "Winter {Category}" → Preview → pick "Women › Western Wear › Jeans" →
sees "Winter Jeans", family 1, the rule_json, the LIVE product count and an
8-product sample (image/name/effective price/% off). Zero-match shows an
honest empty state ("fills as brands list matching products"), never an error.
Price/offer templates preview platform-wide without a leaf (families 2/3) or
scoped to one leaf (families 4/5 — "Jeans Under ₹499", "BOGO Jeans").

## W3 — Admin extends the language
"+ New template" → kind-shaped form (category: group + required tags · price:
effective band · offer: type + min %) → validation (422 on missing {Category},
band inversion, bad type; duplicate name → friendly message). New category
template is instantly addressable across all 195 leaves. Hide removes a
template from (future) creator pickers without touching anything published.

## W4 — Admin curates collections
/admin/collections → seeded names listed → add ("Beach Wedding" → slug
beach-wedding) → rename inline → hide. Duplicate slug → friendly 422.

## Expected end state
node --check green on all new backend files; routes/index loads; service
smoke-tests pass (name gen, families, rule building, validation rejections);
pnpm qa GREEN incl. nav-sweep now covering /admin/concepts + /admin/collections;
gov-check exit 0. Migration applies idempotently (verified locally against
prod only at deploy: run-139.js prints 47/27/9/11/14/0).
