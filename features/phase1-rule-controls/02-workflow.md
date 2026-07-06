# Workflow — Phase 1 rule-control knobs

## W1 — Minimum discount on a Deals shelf
1. Admin edits a Deals shelf → "Rule options" → Minimum discount % = 40 → Publish.
2. Follower feed: that shelf now contains only offers with discount_value ≥ 40;
   offers with smaller or null discounts are gone.
3. Clearing the field (blank) restores the unfiltered shelf.

## W2 — Shops-with-a-live-offer gate
1. Admin edits a Shops row/list → ticks "Only shops with a live offer" → Publish.
2. The shelf now lists only brands with a live campaign-mediated offer OR a
   store-direct published offer inside its window; other approved shops drop.
3. Unticking restores all approved shops with live products.

## W3 — Trending window
1. Admin edits a "Trending now" (top_by_engagement) shelf → Trending window = 3 → Publish.
2. The engagement score now counts clicks+conversions over the last 3 days
   (was invisible 7-day default). Blank restores the default.

## W4 — No regression when knobs unset
Sections without the new keys produce byte-identical SQL (every new clause
collapses to '' when the knob is null/0/absent) — existing shelves unchanged.
