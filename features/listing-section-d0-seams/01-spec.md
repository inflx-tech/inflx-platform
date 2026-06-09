# Feature Spec — D0: Unify the listing↔section seams

> Order: D0 (first of the merge program) · Depends on: — · Status: STUB (draft, not locked).
> Prereq for D1 Business Page. Backend/src refactor; **no DB migration**.

## Problem / goal
The listing engine (what exists) and the section engine (what followers see) were
built separately and meet at three seams that are currently duplicated, divergent, or
unconsumed. Close them so a listed entity flows to the right follower shelf with the
right offer data and CTA vocabulary, with **zero intended follower-facing change** —
this is plumbing, proven by `pnpm qa` staying green.

Three concrete defects to fix:
1. **Taxonomy is hardcoded twice and divergent.** `CATEGORY_MAP` exists in
   `backend/src/services/follower.service.js:155` AND `sectionRules.service.js:33`
   with different contents; `nav_verticals` is frozen in the mig-083 `config_json`
   seed. The real source — each vertical's `super_category` — already lives in
   `backend/public/schemas/*.json` (+ `brand_products.super_category`, mig 013).
2. **Offers have a model of record that nobody reads.** `brand_offers` (Offer Engine,
   mig 084–086) is built, but every section offer shelf still queries `campaign_offers`
   (`sectionRules.service.js`, ~10 rules). No adapter, so Offer-Engine offers never surface.
3. **Availing-mode vocab is too narrow + offer-only.** Validator allows 4
   (`pay_at_store, online_order, prebook, enquiry`, `offerConfig.validator.js:25`); the
   locked design needs `book` (rentals) and `showcase` (display-only).

## Scope
- **In scope:**
  - **A. taxonomy.service** — new `backend/src/services/taxonomy.service.js` sourced
    from the schema files; exposes `getNavVerticals()`, `schemaKeysFor(superCategory)`,
    `superCategoryOf(schemaKey)`; cached via `utils/ttlCache.js`. Replace both
    `CATEGORY_MAP`s and the `navVerticals()` rule's `config_json` read. Normalize
    schema `super_category` to the canonical 7 tiles (`eat/shop/groom/travel/events/
    home/fitness`), incl. rename `beauty`→`groom` and honor schema's `florist`→events.
  - **B. brandOffers.adapter** — new `backend/src/services/brandOffers.adapter.js`
    yielding ONE normalized offer shape over BOTH `brand_offers` (3 channels) and
    legacy `campaign_offers`; preserves the 4-ID chain. Section offer rules consume it.
    Cutover stays behind existing `SECTION_ENGINE_OFFERS` flag (off) — flipped later in `OR`.
  - **C. availing-mode vocab** — widen `VALID_AVAILING_MODES` to the canonical 6
    (`pay_at_store, prebook, online_order, book, enquiry, showcase`); centralize the
    constant so listing + section + CTA read one list. Additive; existing values stay valid.
- **Explicitly out of scope:** Business Page / Product Detail render (D1/D2); flipping
  `SECTION_ENGINE_CATEGORY`/`OFFERS` (CAT/OR); `top_by_sales` (PR); the real
  `category_nodes` drill-down tree (listing roadmap #2); any DB migration; any
  business-level `availing_modes` column (deferred to D1 if review proves offers can't carry it).

## Surfaces touched
- App(s): **backend only** (`backend/src/services/*`). No web, no mobile, no schema files changed.
- Roles involved: none gated — public feed read-path + internal services.

## Data / contracts
- New/changed tables: **none** (no migration). `categories` table left as pricing catalog.
- Files: new `taxonomy.service.js`, `brandOffers.adapter.js`; edits to
  `follower.service.js`, `sectionRules.service.js` (remove maps, consume services),
  `offerConfig.validator.js` (widen vocab). Constant for nav tiles + availing modes centralized.
- Endpoints: unchanged signatures — `/follower/home`, `/section/*` keep returning the
  same shape; only the internal data source changes.
- Money/units/attribution: unchanged. 4-ID chain preserved through the adapter
  (store-direct → `iid` null by design).

## Non-functional
- Auth/role gates: unchanged.
- Failure modes: taxonomy.service degrades to a baked-in fallback map if a schema file
  is missing/unparseable (never throw into the feed); adapter tolerates either offer
  table being empty; **zero intended follower delta** — any feed diff is a regression to
  classify, not accept. Gate = `pnpm qa` green (esp. `section-engine` + `admin-sections`
  suites) + C1 integrity.
