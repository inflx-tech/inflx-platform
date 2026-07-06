# Phase 4 (a+b) — section location override + LIVE allocation

**Program:** Section-rules admin-control program, Phase 4 sub-releases a+b
(locked 2026-07-05; founder go "pls start phase 4" 2026-07-06). Sub-release c
(banner inline matches, mobile+OTA) ships separately.

## 4a — per-section world-rules override (D2)

One shelf may override its world's location behaviour via
`config_json.world_rules_override` `{ location_mode, radius_km, empty_fallback }`:
e.g. a Boundary-15km "Stores near you" shelf inside rank-only Fashion, or one
shelf opting out of Food's boundary. Engine merges the override over the world
row (`mergeWorldRules`); admin validator rejects malformed overrides; the
"Rule options" box (wizard Step 3 + inline editor) gains a Location select +
radius input for products/brands/restaurant_list shelves.

## 4b — LIVE allocation (D1) + coupon-door fix

**Discovery that reshaped the design:** the brand offer builder ALREADY writes
`offer_config_json.scope` = 'store' | 'category' | 'products' — but every
allocation reader ignored `scope` and unioned only the frozen product arrays,
which are EMPTY for store/category scopes. So "entire store" offers allocated
ZERO listed products, and the "snapshot staleness" problem was really a
"scope ignored" problem. No migration, no new column, no UI change needed.

`resolveAllocatedProductIds({ciCfg, offerProductsJson, brandId})` in
follower.service now honors scope LIVE:
- 'store' → all currently-pushed products of the brand (new products auto-flow
  to creator stores; un-push pulls them — Phase 0 rule preserved)
- 'category' → currently-pushed products in that section
- 'products' / bogo / bundle / absent → legacy frozen union (unchanged)

Updated readers: resolveStore, creator store preview,
sectionLibrary.creatorAllocatedProductIds, resolve-coupon.

**Genuine defect fixed (carved into this contract):** POST
/v1/follower/resolve-coupon selected `cs.products_json` — a column that has
NEVER existed on campaign_sets — so every coupon resolve 500'd in prod.
Corrected to `co.products_json` + scope-aware live resolution;
regression-locked by test.

## Out of scope
4c banner inline matches (mobile renderer, OTA, Maestro) — next sub-release.
Mobile brand-app offer builder parity: already writes the same
offer_config_json vocabulary; no change needed.
