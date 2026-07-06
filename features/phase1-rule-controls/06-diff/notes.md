# Before / after — Phase 1 rule-control knobs

## Deals shelves (offers)
- **Before:** only knob = item count. A "Biggest discounts" strip mixed a 5%
  offer with 80% ones; no way to floor it.
- **After:** "Minimum discount %" in wizard Step 3 + inline editor →
  `config_json.min_discount_pct` → legacy SQL `AND co.discount_value >= $n`
  (7 rules + top_picks) and V2 `rankForRule` filter. Null-discount offers
  drop when a floor is set (unit-tested).

## Shops shelves (brands)
- **Before:** `businesses_in_category` listed every approved shop with live
  products; "stores on sale" rail impossible.
- **After:** "Only shops with a live offer" → `config_json.has_live_offer`
  → `anyLiveOfferExists(b.id)` counting BOTH the campaign chain and
  store-direct `brand_offers` published in-window (V2-era definition).

## Trending windows
- **Before:** `cfg.window_days → ctx.windowDays` fully plumbed since the
  engine's birth, but no UI field existed — invisible 7-day default.
- **After:** "Trending window (days)" input for top_by_engagement /
  top_by_conversions / top_picks / creator_top_picks.

## Explicitly NOT changed
- `rule_json.brand` facet — already exposed in Section Library UI (the
  suspected `brand_facet` gap was not real; verified `def.brand` at the
  brandFacetIdx site).
- `follow_graph` — personal shelf, no discount floor.
- One replace_all overshoot into libraryProducts' SQL (a `co.` clause in a
  query with no `co` alias) was caught by grep-count (8≠7) and removed
  before any test ran.

## Verification
- brandOffers adapter suite 27/27 (new minDiscountPct case).
- section-engine suite: same 3 pre-existing failures as the Phase 0 baseline,
  8 passing — including biggest_discounts + deals_ending_soon which execute
  the edited SQL. Zero new failures.
- node --check + esbuild JSX parse clean. pnpm qa: see lock qa note.
