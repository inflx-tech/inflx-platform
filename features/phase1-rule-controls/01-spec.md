# Phase 1 — per-section rule-control knobs (finish Layer 2)

**Program:** Section-rules admin-control program, Phase 1 (locked in chat 2026-07-05).
**Founder go:** "start next phase" — 2026-07-06 (lock delegated under standing autonomy).

## Problem

Rich rule filtering exists only for custom product rules (`library_products`
via the Section Library). Every other shelf exposes just an item limit:

- Deals shelves cannot express "only offers ≥ N% off" — a 5% offer rides
  every "mega sale" strip.
- Shops shelves cannot express "only stores with a live offer".
- The freshness window behind trending/top rules (`cfg.window_days`) is
  plumbed end-to-end in the engine (`ctx.windowDays`) but has NO admin input
  anywhere — it silently defaults.
- (Investigated, not a gap: `rule_json.brand` IS the catalogue-brand facet
  filter and IS already in the Section Library UI — no `brand_facet` work.)

## Scope

Three per-section knobs stored in `config_json` (tolerant validator passes
them through; engine already receives `ctx.config`):

1. **`min_discount_pct`** (offers shelves) — legacy SQL rules gain
   `AND co.discount_value >= $n` (7 deals rules + top_picks; follow_graph
   excluded — personal shelf); V2 `rankForRule` filters
   `discount_value >= minDiscountPct`. Helper `minDiscountFrom(ctx)`.
2. **`has_live_offer`** (brands shelves) — `businesses_in_category` gains
   `AND anyLiveOfferExists(b.id)`; the new helper counts BOTH the legacy
   campaign chain AND store-direct `brand_offers` (published_to_store,
   active, in window) — the honest V2-era definition.
3. **`window_days`** (windowed rules: top_by_engagement, top_by_conversions,
   top_picks, creator_top_picks) — UI exposure only; engine plumbing existed.

Admin UI (App Builder): a conditional "Rule options" group in wizard Step 3
and in the inline editor — Minimum discount % (offers), "Only shops with a
live offer" (brands), Trending window days (windowed rules). Blank/0/null =
no filter (backend treats null as absent).

## Out of scope

Banner hide-when-empty (Phase 2), per-world World Rules (Phase 3),
live allocation (Phase 4). `all_offers` hardcoded limit=30 left as-is.
