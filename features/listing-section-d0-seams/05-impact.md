# Impact — D0: Unify the listing↔section seams

## Terse verdict
**Zero intended functional disturbance to followers — internal plumbing only.** The
feed must look identical post-change (one deliberate exception: `florist` now groups
under **events** instead of shopping). Risk is a faithful-map regression, caught by the
"feed-unchanged" snapshot assertion + full `pnpm qa`.

## What changes mechanically
- Two hardcoded `CATEGORY_MAP`s and the mig-083 `nav_verticals` config become a single
  schema-sourced `taxonomy.service` (cached). No DB change.
- Section offer rules read a `brandOffers.adapter` (normalized shape) instead of inline
  `campaign_offers` SQL — but with `SECTION_ENGINE_OFFERS` still OFF, the resolved set is
  unchanged; brand_offers inclusion is dormant until the `OR` contract.
- Availing-mode vocab widens 4→6 (additive); no existing row invalidated.

## Blast radius
- **Production-impacting** (touches `backend/src/**`) but **additive + behavior-neutral**;
  no migration, no schema-file edit, no web/mobile change. Rollback = revert the commit
  (no DB state to unwind).
- Read-path only; no writes, no money path, no auth change. 4-ID attribution preserved.

## Open questions (resolve before/at lock)
1. **Adapter dedup key** when a brand has both a legacy `campaign_offers` row and a new
   `brand_offers` row for the same promotion — prefer `brand_offers` (model of record)?
   *Proposed: yes, brand_offers wins; campaign_offers de-duped out by (brand_id, name).*
2. **Fallback map** — bake the §1 canonical map as the in-code fallback so a bad schema
   file can never blank the nav? *Proposed: yes.*
3. **`book` vs `prebook`** semantics for rentals — confirm `book` = rental/slot booking,
   `prebook` = advance-reserve-then-pay-at-store. *Proposed: keep both; rentals use `book`.*

## Why this is first
D1 (Business Page) keys its layout off `super_category` and its CTA off `availing_modes`,
and every shelf ranks listed entities by taxonomy — so the single taxonomy source + the
offer adapter + the full CTA vocab must exist before the render surface is built. Doing
it as a behavior-neutral refactor de-risks the visible Phase-D work that follows.

## Re-diagnosis after code review (2026-06-09) — the real root cause
The first build anchored the offers on the Offer-Zone library (`brand_offers`). Code
review of the campaign-attach flow (`campaign.controller.js resolveOfferAttachment` +
`invite`/`update`) proved that wrong. The TRUE picture:
- The section shelves INNER-JOIN `campaign_offers`, whose only writer is marked
  **"legacy — kept for backward compat"** (`campaign.controller.js:1070`). That table
  is effectively empty → the shelves are dark.
- The REAL offers live on the creator's assignment row `campaign_influencers`:
  `offer_type`+`offer_config_json` are the **per-creator snapshot** taken at attach
  (library is authoritative *at attach*; later library edits never mutate a live
  attachment — so we must read the SNAPSHOT, not the library master); `allocation`
  decides conversion (`commissioned` → tracked, creator earns) vs engagement
  (`promotional` → showcase only, no commission); `brand_offer_id` /
  `promoted_brand_offer_ids[]` are provenance to the library.
- The OLD follower feed already reads this correctly (`follower.service` LEFT JOINs
  `campaign_offers` and falls back to the ci snapshot). The adapter now mirrors that.

## Resolutions — Workstream B delivery (REBUILT 2026-06-09)
Delivered: `backend/src/services/brandOffers.adapter.js` (re-anchored) +
`SECTION_ENGINE_OFFERS` flag (env.js, default OFF) + `tests/brandOffers.adapter.test.js`.
Workstreams A (taxonomy) and C (vocab) deferred.
- **Primary source = creator assignment** (`fetchAssignmentOffers`), reading the ci
  SNAPSHOT (drift-safe), classifying conversion vs engagement by `ci.allocation`
  (`channelOfAllocation`; legacy null-allocation rows with an offer → conversion).
  Catches BOTH inline-in-campaign offers AND single library attaches. Name +
  availing_modes enriched from the library row when `brand_offer_id` is set.
- **Two offer-type vocabularies handled:** library snapshot vocab
  (`discount/volume/bogo/bundle/free_gift`, via `extractDiscount`) and legacy inline
  vocab (`flat/percentage/bogo/bundle/volume/prebook`, via `extractLegacyDiscount`,
  reading `offer_config_json.value` then the SQL-resolved `discount_value`). Both
  normalize to the legacy display vocab the mobile cards already interpret.
- **Engagement showcase multi-select** (`fetchShowcaseOffers`) = library offers in
  `promoted_brand_offer_ids[]`, promotional, NO tracking, creator shown.
- **Store-direct** (`fetchStoreOffers`) = `published_to_store`, no creator, no tracking.
- **Headline `discount_value`:** pct→points, flat→rupees, volume→top tier %;
  bundle_price is NOT a discount magnitude (value=null) so it can't pollute
  `biggest_discounts`; bogo/free_gift carry no number.
- **4-ID attribution:** conversion only → tracked link (`oid = brand_offer_id ||
  campaign_offer.id || null`, `iid` = creator); engagement + store → `tracking=null`.
- **Dedup** on `(source,id,creator)`; conversion > engagement > store.

## Verification state (honest)
- Pure normalization logic: **verified** — 22 standalone assertions pass + Jest suite
  rewritten for the corrected model. No DB needed for these.
- Channel SQL (`fetchAssignment/Showcase/StoreOffers`): **written per the corrected
  model, NOT yet executed** — no offer rows reachable in the build sandbox (prod creds
  absent; test DB on :5544 unreachable). Validated at **OR-time** against prod data.
- `pnpm qa` + the Jest suite must run where the test DB exists (CI / founder local)
  before push. Adapter is additive + unconsumed → expected zero regression.
- Founder confirmed (verbally) prod has offers created + allocated to creators →
  those allocations are exactly what `fetchAssignmentOffers` reads, so the OR flip
  should light up the conversion + engagement shelves, not only store-direct.

## Next (separate, gated)
`OR / section-offer-repoint`: wire the offer rules onto `adapter.fetchOffers`/`toFeedItem`
and flip `SECTION_ENGINE_OFFERS` on. **Production-impacting + OTA.** Preconditions:
(1) `scripts/check-offer-data.js` against prod to size each channel; (2) explicit founder go.
