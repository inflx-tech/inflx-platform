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

## Resolutions — Workstream B delivery (2026-06-09)
Delivered: `backend/src/services/brandOffers.adapter.js` + `SECTION_ENGINE_OFFERS` flag
(env.js, default OFF) + `backend/tests/brandOffers.adapter.test.js`. Workstreams A
(taxonomy) and C (vocab) deferred. Decisions taken while building:
- **Dedup key (Q1, revised):** keyed on `(source, id)`, NOT `(brand_id, name)`. A
  campaign_offer and a brand_offer are *distinct underlying rows* even if conceptually
  related — collapsing them by name would silently hide one. The same brand_offer
  surfaced via multiple channels collapses to the highest-priority channel
  (`conversion > engagement > store > campaign`), since conversion is the
  attributable/commissioned instance. (Cross-source semantic de-dup, if ever wanted,
  is a separate explicit decision — not silently folded in here.)
- **offer_type vocab bridge:** brand_offers vocab (`discount/volume/bogo/bundle/free_gift`)
  is mapped to the legacy display vocab the mobile cards already interpret
  (`percentage/flat/volume/bogo/bundle/free_gift`); `discount`+`sub_type` decides
  percentage vs flat. Pure + unit-tested (`mapBrandOfferType`).
- **Headline discount (`discount_value`):** pct→points, flat→rupees, volume→top tier %.
  **bundle_price is NOT a discount magnitude** (value=null) so it can never pollute
  `biggest_discounts` ordering; bogo/free_gift carry no headline number. Pure + tested.
- **4-ID attribution per channel:** conversion → full tracked link with `oid =
  brand_offer.id` (legacy keeps `oid = campaign_offer.id`); engagement → creator shown
  but `tracking=null` (promotional/awareness, no commission, per mig-084 semantics);
  store-direct → no creator, `iid` null by design.
- **Fallback map (Q2) / book-vs-prebook (Q3):** untouched — they belong to Workstreams
  A/C, deferred.

## Verification state (honest)
- Pure normalization logic: **verified** — 22 standalone assertions pass + a Jest suite
  (`tests/brandOffers.adapter.test.js`) authored. No DB needed for these.
- Channel SQL fetchers (`fetchStore/Conversion/EngagementOffers`): **written per design,
  NOT yet executed** — no `brand_offers` rows reachable in the build sandbox (prod creds
  absent; local `inflx_dev` lacks mig 084-086; test DB on :5544 unreachable). Validated
  at **OR-time** against real prod data.
- `pnpm qa` + the Jest suite must run on a machine with the test DB (CI / founder local)
  before this is pushed — the sandbox cannot reach it. Adapter is additive + unconsumed
  → expected zero regression, but the gate is run there, not claimed here.

## Next (separate, gated)
`OR / section-offer-repoint`: wire the 10 offer rules onto `adapter.fetchOffers`/`toFeedItem`
and flip `SECTION_ENGINE_OFFERS` on. **Production-impacting + OTA.** Preconditions:
(1) confirm migrations 084/085/086 are applied to prod and real `brand_offers` rows exist
(+ whether the CI attach columns `brand_offer_id`/`promoted_brand_offer_ids` are actually
populated — if empty, only the store-direct channel surfaces); (2) explicit founder go.
