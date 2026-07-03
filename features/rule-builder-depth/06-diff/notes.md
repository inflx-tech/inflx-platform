# Before/after diff — rule-builder-depth (P4)

**Before** = 04-preview/mockups/00-rule-depth.html (locked via founder's
blanket P4+P5 completion delegation, 2026-07-03).
**After** = 06-diff/after/01-wizard-rule-depth.png — the wizard My-rule
builder with the three new controls live (Brand input, Exclude-tags chips,
Hand-pick search + ordered pick list).

## Differences vs mockup
- Controls sit inside the existing amber builder panel (P2 styling) rather
  than the mockup's standalone card — same fields, same order, same copy.
- Exclude chips use red + line-through when active (mockup intent) and render
  only when the world has a tag vocabulary — identical condition to the
  existing must-have tags chips.
- Section Library page: Brand + Exclude tags as full controls; hand-picked
  ids shown as a preserved count chip with "edit picks in the App Builder
  wizard" + clear (prevents the silent-strip-on-edit failure mode).

## Verification (2026-07-03, local e2e, real JWT + dev DB — 14/14)
- preview accepts exclude_tags (count ≤ baseline) · brand + exclude_tags
  SURVIVE library save (the pre-existing silent-strip bug is fixed) ·
  product-search 200 with gated-only results + 401 unauth ·
  hand-pick: count = picks AND **returned order = admin's pick order** ·
  >50 ids and non-array shapes → 422 · legacy rule byte-identical (regression)
  · all three controls render in the wizard.
- Env notes (classified, not defects): local dev DB was missing migs
  099/100/101/118 (brand_products.mrp / pushed_to_store / tag_vocabulary) —
  applied locally; fashion tag vocabulary was empty — seeded one QA tag to
  prove the conditional render.
- Full pnpm qa recorded in lock.json.
