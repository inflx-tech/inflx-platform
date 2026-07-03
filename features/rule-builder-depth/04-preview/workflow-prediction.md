# Workflow prediction — rule-builder-depth (P4)

Mockup: 00-rule-depth.html — the My-rule builder with three additions (Brand,
Exclude tags, Hand-pick with ordered list). Same fields on the Section Library
page so an edit there can't strip the new keys.

Predicted runtime behavior:
- Backend accepts brand / exclude_tags / product_ids in rule_json (validateRule
  passes them through); the engine honors them incl. hand-pick ORDER. The
  existing tile-builder Brand field starts genuinely working (was silently
  stripped on save-for-reuse).
- New GET /admin/section-library/product-search powers hand-pick.
- Zero mobile impact — rules resolve server-side; payload shape unchanged.
- Existing library rules unaffected (new keys optional; validator unchanged
  for old keys).
