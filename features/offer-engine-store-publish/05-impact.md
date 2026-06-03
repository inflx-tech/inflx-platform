# Impact Analysis — offer-engine-store-publish (D Phase 1, backend)

## Verdict (terse)
**Additive + dormant — zero disturbance to live store/money flows.** A migration
that only ADDs two columns, three new optional fields on the offer-update path,
and a new `store_offers` array on the store response. No existing query, money
path, or response field changes.

## Mechanics
- **Migration 085 is purely additive + idempotent.** Two `ADD COLUMN IF NOT
  EXISTS` on `follower_transactions` (`brand_offer_id` nullable, `offer_source`
  defaulted to `'influencer'`) + a partial index. No drops, no type changes, no
  backfill, no constraint tightening. Existing rows get `offer_source='influencer'`.
- **No writer for the new columns yet.** The store-direct purchase path (D2) is
  the only writer; until then every transaction is `'influencer'` exactly as
  today.
- **`updateOffer` additions are optional.** Omitted (every caller today) → no
  change. `published_to_store` defaults false; the existing offer fields are
  untouched.
- **`resolveBusinessStore` is extended, not modified.** The existing FEED_QUERY +
  `influencers[].offers` assembly is byte-unchanged; a separate brand_offers query
  appends a new `store_offers` array. Current follower-mobile reads
  `influencers[].offers`, so it ignores `store_offers` → dormant.
- **No engagement/commission/attribution logic touched.**

## Blast radius if it failed
The new `store_offers` query runs inside `resolveBusinessStore`; if it threw it
could affect the store response — mitigated: the query only references columns
that exist (084) and is covered by tests (4/4) + the follower-store regression
baseline (no added failures). The columns + publish fields cannot affect any
existing transaction.

## Regression guard
`offer-store-publish.test.js` 4/4 GREEN; `follower-store.test.js` failures not
increased by this change (8 vs 9 baseline — pre-existing tier-seed debt). Existing
store output (`influencers[].offers`) unchanged.

## Deploy posture
PRODUCTION-IMPACTING (migration 085 + backend/src) but DORMANT. Backend-only →
Render auto-deploy + a prod migration (`run-085.js`). No OTA/web. Surfaced for
explicit go.
