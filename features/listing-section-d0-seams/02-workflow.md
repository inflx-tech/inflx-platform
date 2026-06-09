# Workflow — D0: Unify the listing↔section seams

> The end-to-end path the implementation must execute to its expected end state.
> Backend-only refactor; success = identical follower feed proven by green QA.

## Actors
- **System** (backend services): taxonomy.service, brandOffers.adapter, section rules.
- No human actor in the runtime flow (this is plumbing). Admin/founder only at the
  release gate.

## A. Taxonomy unification flow
1. Boot / first feed request → `taxonomy.service` enumerates `public/schemas/*.json`,
   reads each `super_category`, normalizes to the 7 canonical tiles, builds:
   - `navVerticals` = ordered [{key,label,icon,order}] for the 7 tiles.
   - `superToSchemaKeys` = { eat:[restaurant,bakery,…], shop:[…], … }.
   - `schemaToSuper` = reverse map.
   - Result cached (ttlCache); `clearTaxonomyCache()` for tests.
2. `sectionRules` ranking functions that filtered `brands.category IN (CATEGORY_MAP[x])`
   now call `taxonomy.schemaKeysFor(superCategory)` and inject the array into SQL.
3. `navVerticals()` rule returns `taxonomy.getNavVerticals()` instead of `ctx.config.verticals`.
4. `follower.service` legacy feed (`getHomeFeed`/`getDealsByCategory`) uses the same service.
5. **Expected end state:** every shelf that grouped by vertical returns the SAME brand/
   offer set as before (faithful map), but from one source. `florist` now resolves to
   `events` (was `shopping`) — the one intentional correction; assert it explicitly.

## B. Offer adapter flow
1. A section offer rule asks the adapter for offers in scope (city/vertical/creator/follow-graph).
2. `brandOffers.adapter`:
   - queries `brand_offers` joined via campaign-mediated distribution
     (`campaign_influencers.brand_offer_id` = conversion; `promoted_brand_offer_ids` =
     engagement; `published_to_store` = store-direct),
   - queries legacy `campaign_offers` (the canonical live chain),
   - normalizes both to `{id, source, brand_id, name, offer_type, availing_modes,
     discount, channel, tracking{cid,sid,oid,iid}}`, dedups, returns.
3. Section rule ranks/limits the normalized list; `sectionEngine` attaches 4-ID tracking
   (already from `tracking.buildTracking`); store-direct rows carry `iid=null`.
4. **Expected end state:** with `SECTION_ENGINE_OFFERS` OFF, follower offer shelves are
   byte-identical to today (adapter returns the same campaign_offers set). brand_offers
   inclusion is dormant until the `OR` flag-flip contract — so D0 ships safely.

## C. Availing-mode vocab flow
1. `VALID_AVAILING_MODES` widened to 6; constant centralized (single export).
2. Validator accepts the 2 new values; existing offers/rows unaffected (additive).
3. **Expected end state:** validation tests for the 6 modes pass; no existing offer
   becomes invalid.

## Verification (System B matrix)
- **Happy path:** `/follower/home`, `/section/category/:key`, `/section/offers`,
  `/section/creator/*` return the same shelves/items as a pre-change snapshot.
- **Edge:** missing/garbled schema file → fallback map, no 500. Empty `brand_offers`
  → adapter returns campaign_offers only. Empty `campaign_offers` → no crash.
- **Regression:** `pnpm qa` full (esp. `backend/tests/section-engine.test.js`,
  `admin-sections.test.js`) green; C1 integrity; `florist→events` assertion added.
- **Money/attribution:** 4-ID chain unchanged on every shelf item; store-direct iid null.
- `qa:db` informational only.

## Done when
Green `pnpm qa` with the new services in place, both `CATEGORY_MAP`s deleted, offer
rules on the adapter (flag still off), vocab = 6, and an explicit "feed unchanged"
assertion for at least one vertical + the florist correction.
