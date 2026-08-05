# Before / after — Bulk Move category + Attach offer

## What changed

| | Before | After |
|---|---|---|
| Bulk bar | Hide · Show · Edit price · Remove | + **Move category** · **Attach offer** |
| Fixing a mis-filed product | Delete and re-add — losing the SKU, photos and variants | Move it; all of that is kept |
| Putting products on an offer | Only from inside the offer builder, one offer at a time | Select products → attach to an offer |
| Refusals | n/a | Named per product, with the reason |

Two additive endpoints, no migration:
`POST /brands/me/listing-products/move` · `POST /brands/me/offers/:id/products`.

## Decisions taken from the code, not assumed

- **A move rewrites four columns, not one.** `insertProducts` derives
  `category_node_id`, `category_key`, `super_category` **and** `section` from the
  node. Rewriting only the node id would leave `section` stale — and `section` is
  what category-scoped offers match on, so the product would keep drawing a
  discount for a category it had left.
- **SKU is safe.** `${storeCode}-${pad4(seq)}` is a brand-level sequence with no
  category component, so a move can't invalidate a SKU or its `variants_json`.
- **Sizes are checked against the target's vocabulary**, using the `SIZE_SYSTEMS`
  the backend already owns for Excel templates — newly exported rather than
  copied, so there is still one definition. A Free-Size kurta moves between
  free-size leaves; alpha shirts are refused entry to UK-sized footwear, with the
  offending sizes named.
- **Attach is limited to `discount` and `volume` offers scoped to products.**
  Per `offer.service.js`: `bundle`'s products array is the bundle *set* (adding
  to it breaks the bundle), `bogo` and `free_gift` use pair shapes, and an offer
  scoped `store` or `category` ignores its products array entirely — attaching
  there would be a silent no-op. The picker says so instead of hiding them.
- **A legacy no-scope, no-products offer is refused.** `resolveScope` treats that
  as store-wide, so attaching would quietly shrink a store-wide discount down to
  a handful of products.

## Verification performed

- **`pnpm qa` GREEN — 120 passed, gate 0** (2026-08-05, report
  `qa/reports/2026-08-05T06-41-25-327Z/QA-REPORT.md`). Baseline was 98; the 22
  new tests are this contract's. Zero regression.
- **22 new unit tests** in `qa/unit/listing-bulk-rules.spec.ts` covering the pure
  rules: legal move, parent-category refusal, same-category refusal, missing
  required facet (named), vanished target, alpha→UK size refusal, size judged on
  values rather than on systems differing, size-required leaf refusing a
  size-less product, every offer-type and scope refusal, legacy-config handling,
  and that merging dedupes, is idempotent and preserves the rest of the config.
- **`next build` on brand-web: compiled successfully**, lint + type check
  passed, `/dashboard/products/listing` present at 21 kB.
- `node --check` clean on all six changed backend files.

### One test corrected during the run

`a product with no sizes is not blocked by the target size system` failed on
first run. The **test** was wrong, not the code: `taxonomy.sizeRequired()` makes
Size required for any non-free size system, so a size-less product genuinely
cannot land in UK-sized footwear. The assertion was rewritten to state the real
behaviour, and a companion case added for the free-size leaf where it does pass.
No assertion was weakened to obtain green.

## Verification NOT performed

- **Neither endpoint has been called against real data.** No brand session or
  seeded fashion products locally, so the move and attach round-trips, the two
  modals, and the per-product result line have not been exercised end-to-end.
  The rules underneath are unit-tested; the wiring is not.
- No Playwright before/after image pair for the modals — that needs the
  authenticated route.
- The port-3002 dev server was held by a parallel session, so a live DOM check
  was not possible this round; the production build stands in for compile proof.

These land in the founder's single end-to-end pass. `release.released` stays
`false`.

## Suggested walk when verifying

1. Tick two products in one category → **Move category** → pick a leaf that
   requires a facet they lack. Expect a refusal naming the facet, not a move.
2. Move them somewhere legal. Confirm SKU and photos survive and both tree
   counts change.
3. **Attach offer** with a bundle and a store-wide offer in the library — both
   should appear greyed with reasons, not missing.
4. Attach the same products twice. The second time should report them as already
   on the offer and change nothing.
