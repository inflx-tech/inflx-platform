# Before / after — Phase 4a+4b

## 4b — allocation honors the brand's declared scope, live
- **Before:** all four allocation readers unioned only the frozen product
  arrays in offer_config_json / campaign_offers.products_json. For
  scope='store'/'category' those arrays are empty BY DESIGN (the builder
  fills `products` only for scope='products') → "entire store" offers put
  ZERO listed products in creator stores; and the whole model was frozen at
  attach time.
- **After:** `resolveAllocatedProductIds` resolves store/category scopes with
  one live indexed query (is_active + pushed_to_store [+ section]); list
  scope + bogo/bundle byte-identical. Readers: resolveStore, creator preview,
  creatorAllocatedProductIds (creator-scoped shelves), resolve-coupon.
- **Design economy note:** the original plan assumed a new column + migration
  + builder UI. Verify-twice showed the brand UI already captured intent in
  offer_config_json.scope — the entire feature reduced to honoring it at
  read time. Zero migration, zero UI change.

## 4b — genuine defect fixed
- **Before:** POST /v1/follower/resolve-coupon selected `cs.products_json`;
  campaign_sets has never had that column (checked 001 + all additive
  migrations + live test-DB information_schema) → every call 500'd.
- **After:** selects `co.products_json`; scope-aware live allocation; locked
  by regression test (was 401-auth in first test draft — route requires a
  follower token; classified test-assumption error, fixed in test).

## 4a — per-section location override
- **Before:** Phase 3 world rules were all-or-nothing per world.
- **After:** `config_json.world_rules_override` merges over the world row for
  ONE section (engine `mergeWorldRules`; validator enforces enum/radius; UI
  in both Rule options boxes). Proven: override bounds one shelf while the
  sibling keeps the world default (world-rules.test.js 9/9).

## Verification
allocation-live 4/4 · world-rules 9/9 · banner-gateway 3/3 · adapter 27/27 ·
section-engine = 3 ledgered pre-existing only · pnpm qa GREEN gate 0 (see lock).
