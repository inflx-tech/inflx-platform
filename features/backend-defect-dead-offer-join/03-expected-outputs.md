# Expected outputs — dead offer join

## Backend

One shared predicate in `sectionRules.service`:
- `HAS_SOMETHING_TO_SELL` — `(ci.alloc_scope IS NOT NULL OR ci.offer_type IS NOT NULL)`,
  matching the gate the storefront already uses, so a creator cannot be discoverable in a
  section and simultaneously have an empty store.
- `LIVE_COLLAB_CHAIN` / `LIVE_COLLAB_WHERE` — the live-collaboration join and predicate,
  defined once and reused, because two copies of this drift.

Four call sites stop inner-joining `campaign_offers`:
1. `liveOfferExistsForInfluencer` — drives `has_live_deal` and creator-section visibility
2. `liveOfferExists` (brand) — used bare by `topByEngagementBrands`
3. `creatorsInCategory`
4. `follower.service` active-deal count — now `COUNT(DISTINCT ci2.id)`, i.e. live
   collaborations, which is what "active deals" means to a follower

## Deliberately unchanged

- `anyLiveOfferExists`'s store-direct leg — it was masking the defect for brands and must
  keep behaving identically.
- `OFFER_FROM` and the 12 V2-guarded offer rules — unreachable in production, so rewriting
  them is risk without value. Pinned by test J8 so a later sweep re-checks reachability
  first.
- The remaining `campaign_offers` references that are LEFT JOINs — genuinely inert
  (all-NULL columns, every COALESCE already falls through).

## Production evidence (2026-08-11, before the deploy)

| Question | Before | After |
|---|---|---|
| creators with a live deal | 0 | 1 |
| brands with a live deal | 0 | 1 |

The single live collaboration in production becomes visible where it was invisible.

## Verification
`pnpm qa` green; 9 new tests in `qa/unit/dead-offer-join.spec.ts`.
