# Handoff: building Offers (Level 1) and Creator terms (Level 2)

Written 28 Sep 2026 at the end of the design session, for the window that builds these two levels.
The design of record is **`Docs/OFFER_TERMS_POSTS_RULES.md`** (v1.4). This note only adds what the code
does today, so the build starts from facts. Every "today" claim below was surveyed on 28 Sep; re-read
the file before relying on a line number.

## What to hand over

| Item | File | Status |
|---|---|---|
| Business rules | `Docs/OFFER_TERMS_POSTS_RULES.md` §0–§3 (and §4–§5 for context) | Agreed |
| Level 1: offer creation (website) | `features/offer-builder-v2/04-preview/mockups/offer-builder-v2-mockups-v1.html` (O1–O13) | **Mockup locked** 28 Sep. Phone pool builder (P1–P4) NOT locked: website first |
| Level 2: creator terms (brand + creator phone) | `features/creator-terms-v2/04-preview/mockups/creator-terms-v2-mockups-v1.html` (T1–T7, C1–C5) | **Mockup locked** 28 Sep |
| Level 3–5 + follower app | `features/shoppable-posts-v2`, `post-links-codes`, `post-performance`, `follower-app-v2` | Drawn, **not locked**: lock before building posts |
| Raw decision log | `Docs/OFFER_POSTS_PROGRAMME_DECISIONS.md` | Reference |

Each feature folder has only `lock.json` + mockups. The contract files (01-spec, 02-workflow,
03-expected-outputs, 05-impact) still have to be written. Neither level has `approved: true` yet.

## Build order
1. **Level 1: offers.** Pools, locking, required dates, the 5 types / 11 sub-types, gift items, publish
   checks, statuses, live-offer changes (remove products / end now), price-change warning, the brand
   website screens (O1–O13).
2. **Level 2: creator terms.** Offers linked to a collaboration (many), products without offers
   (frozen), terms validation, agreement text, creator read-only view, notifications.
3. Then Level 3 (posts), after its board is locked.

## What the code does today (surveyed 28 Sep)

**Offer engine**
- One table `brand_offers` (migration 084, never altered): `offer_type`, `offer_config_json`, `availing_modes`,
  `status` draft/active/archived, `published_to_store`, `store_starts_at/ends_at` (optional).
- Validator `backend/src/services/offerConfig.validator.js`. Pricing `offer.service.js` + choice
  `offerResolution.service.js` (the single best offer wins the whole cart; never combined).
- Scope store/category/products exists for discount and volume only. BOGO, bundle and free gift use
  fixed product ids inside the JSON. **No product join table.**
- Missing entirely: locking/overlap checks, pick-any and mix-and-match bundles, spend-threshold and
  buy-X free gifts, gift choice, gift items, gift stock, max ₹ cap, flat-less-than-cheapest check,
  ₹ volume rewards, the 1–4 tier limit, paused/ended states, expiry job, price-change re-check,
  "products not in any offer" and "which offer is this product in" endpoints.
- BOGO frees at the **base** price, not the variant's. Checkout ignores the per-size price in
  `variants_json` for fashion.
- **Stock is never reduced at checkout.** Gift stock and "all products out of stock" need real stock counting.
- `mrp` column is dormant (always NULL). The product's price is `brand_products.price`.
- Category tree: `category_nodes`, 3 levels (segment › category › leaf). Brand label is `facets.brand`.
- Brand website: Listings → Offers tab (`app/dashboard/products/components/OffersLibrary.js`, `components/OfferBuilder.js`).
  The brand phone app has no offer screens (deleted 10 Sep). `OfferBuilderSheet.js` / `CreatorOfferSheet.js` are orphans.

**Creator terms**
- Terms screen: `Packages/Mobile/src/screens/brand/BrandCreatorTermsScreen.js`, sheets in
  `components/invitations/sheets5.js`, draft logic `draft5.js`, copy `copy5.js`.
- One service writes every invitation: `backend/src/services/invitationSend.service.js`; terms validator
  `invitationTerms.service.js`; inputs `invitationInputs.service.js`.
- Selling scope = `campaign_influencers.alloc_scope / alloc_category_node_id / alloc_category / alloc_product_ids`
  (migration 148), **one category only**. About a dozen readers: resolver `follower.service.js`, post picker
  `creatorPosts.service.js` → `sectionLibrary.creatorAllocatedProductIds`, `postEligibility.service.js`,
  publish gate, remote parcel/shoot, `collabEarnings.service.js` (disagrees with the resolver on category),
  agreement snapshot `agreementTerms.service.js`, `contract.controller.js`, negotiation thread.
- Offers today: a saved offer is **copied** onto the row (`brand_offer_id` kept as provenance); a special offer is
  stored inline; `promoted_brand_offer_ids` exists server-side only. None of these check offer dates or status.
- **Checkout never checks her selling scope**: commission is paid on the whole cart (`transaction.controller.js`
  `priceOrderForGroup`, `transaction.service.js` `validateTracking`). Level 2 must enforce it on the server.
- Posting date = `campaign_sets.go_live_date` (migration 165); join cutoff = posting date − 3 (server `canInvite`).
- One live collaboration per creator per set: unique index `uq_ci_live_per_set` (migration 181).
- Terms are locked after sending (`PATCH …/influencers/:ciId` throws LOCKED).
- Negotiation (item 6) counters only money/content terms; offers and scope are not counterable. Keep it that way.
- Agreement `contracts.terms_json` (item 7) prints the selling scope and deliberately **omits the offer**.
  Level 2 changes this: list offers as of signing.
- The old per-creator code is `campaign_influencers.coupon_code`. It is **retired** by rules 2.10; stop
  generating it and don't break readers blindly.
- No notification exists for an offer ending or a product being removed.

## What gets retired (rules 1.13, 2.2, 2.10)
Whole-store offers · publish-to-store and the store-direct pay path · availing modes · special offers and
"save to my offers" · copying an offer onto an invitation · `promoted_brand_offer_ids` · the store/category/
products selling scope · the bulk "Attach offer" action · the old per-creator offer code · old offer shapes
(existing offers archived; production offers are test data). Retire **outside-in** (screens → engine → data),
one cut per commit (`Docs/THE_CUT.md` method).

## Things that will bite
- **Money path.** Checkout changes (per-product offers, scope enforcement, stock) are production-impacting.
  Explicit go before any push, migrations first (`.env.prod-backup` + `run-0XX.js`).
- **No shopper screens exist** (profile-only since 10 Sep), so checkout behaviour can only be proven by
  server tests and API calls, not by walking the app. Say so; never fake-green.
- **Parallel windows share one working tree.** Stage by path, never `git add -A`.
- Backend test DB is the scratchpad pg on 5544. The test suite has about 231 known failures. Certify
  no-regression, not green; run serially.
- Mobile ships by OTA, one app at a time. Link-opening and install deep links need an APK (Level 4, later).
- Windows: never rewrite source through PowerShell Get-Content (it mangles — and ⚠️). Use Edit or node.

## Open for the founder (not blocking Levels 1–2)
Margin floor (deferred) · offers on the phone (after the website) · shoot-plan rules (Level 3) ·
Discover design · checkout, returns, addresses, pay at store.
