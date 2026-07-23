# Build Readiness — code reality vs the Post/Concept architecture

**Status:** analysis · 2026-07-22 · no code changed
**Reads with:** `POST_CONCEPT_MODEL.md` (target) · `CONTROLS_MAP.md` (admin + creator surfaces)
**Method:** full code sweep of `backend/src`, `backend/migrations`, `backend/scripts`, `Packages/Mobile/src`, `Packages/brand-web`. Backend root is `C:\WORK\inflx-platform\backend` — **`Packages/backend` does not exist.**

---

## 0. Verdict at a glance

| Subsystem | State | One line |
|---|---|---|
| Auth, roles, app delivery | 🟢 | OTP+JWT+refresh, 4 Android flavors, one JS bundle, custom OTA with a native-runtime gate |
| Brand → product listing | 🟢 | Drill-down tree + facets + variants, leaf-gated batch insert |
| Offer engine | 🟢 | 5 types, one JS resolver, live gate with scheduling |
| Money spine | 🟢 | Campaign → contract → deliverable → commission → escrow → payout, all live |
| Cart → checkout → order → attribution | 🟢 | Multi-brand cart, real Razorpay + mock fallback, 4-ID attribution + coupon claim |
| Section engine (config, context, ranking) | 🟢 | 26 rules, city/geo/follow/brand/creator context, scheduling, caching, empty-fallback |
| Notifications | 🟢 | 48 types, OneSignal wired end to end |
| Governance + QA gates | 🟢 | gov-check 5 rules, Playwright + Jest + Maestro lanes |
| **Discover layout rendering** | 🟡 | Chip row exists but is **non-interactive**; banner carousel with dots exists; the composite section never assembled |
| **Concept filtering** | 🟡 | `library_products` is ~80% of it; cannot filter by offer TYPE, post-offer price, or generic facet |
| PDP | 🟡 | Exists but returns **zero offer data**; offers arrive from the section item instead |
| Search | 🟡 | Exists, food-defaulted, no creators/offers, and its screen is orphaned |
| Media upload | 🟡 | R2 presign works; **no creator-scoped presign**; crop is web-only |
| Follows | 🟡 | Creators only — **no brand follow** anywhere |
| Engagement telemetry | 🟡 | `section_events` is section-level, `tap`/`see_all` only |
| **Creator posts / videos** | 🔴 | Does not exist. No entity, no coordinates, no feed, no tab |
| **Concepts / templates / collections** | 🔴 | Does not exist in any form |
| **Post-returning rules** | 🔴 | All 26 rules return products/offers/brands/creators/categories. None return content |
| **Video pipeline** | 🔴 | No transcode, thumbnail, duration, or streaming anywhere |
| **Post moderation** | 🔴 | Approval pattern is proven 18× but no content queue exists |
| **Creator layout building** | 🔴 | Creators have zero layout ability today |

---

## 1. 🟢 GREEN — reuse as-is

**Auth / delivery.** OTP → JWT with silent single-flight refresh (`Packages/Mobile/src/services/api.js:28-60`). One RN codebase, 5 Android product flavors (`brand`, `influencer`, `follower`, `follower.staging`, `agency`) sharing one JS bundle; role resolved at runtime from a native constant. Custom self-hosted OTA (`scripts/publish-ota.js` → `POST /v1/ota/publish` → R2 manifest), Android-only, with a `native_runtime` compatibility gate that 204s incompatible clients (`ota.controller.js:105-107`).

**Listing.** `category_nodes` is Segment(depth 0) → Category(depth 1) → **Leaf(depth 2, `is_leaf=true`)** — exactly the three levels the concept doc assumes. Facets live on `brand_products.facets jsonb` + GIN (deliberately not EAV), with `facet_definitions` resolved most-specific-wins per leaf. Leaf-gated batch insert writes `category_node_id`, `facets`, curated `tags`, and `variants_json`.

**Offers.** `brand_offers` with CHECK `('discount','volume','bogo','bundle','free_gift')`; one reusable resolver `offer.service.resolveOfferDiscount()` for money; a parallel SQL mirror (`OFFER_BEST_PCT`) for card badges. Live gate = `status='active' AND published_to_store AND now() within window`, reused verbatim in 4+ places. Nothing expires rows — exclusion is read-time only.

**Money.** Campaign → offer → negotiation → contract (e-sign + PDF) → deliverable → commission → escrow tranches → withdrawal → TDS. All live and tested.

**Commerce.** Client-side cart (Context + AsyncStorage, multi-brand for shop), server-priced via `POST /follower/cart/price`, one Razorpay order for the grand total, split into per-brand sub-orders on verify. `RAZORPAY_MOCK` gives a working mock across **every** flow. Attribution = a 4-ID tracking block on every actionable item + `attribution_clicks` (30-day) + coupon-code claims.

**Section engine.** `sectionEngine.buildSections()` layers `section_config` global < vertical < city, applies schedule windows, resolves the rule, injects context (`followerId`, `followedIds`, `city`, `lat/lng`, `brandId`, `influencer`, `categoryCats`, `ruleDef`, `worldRules`) and caches on a key that includes all of it. `world_rule_settings` gives per-world `boundary | rank_only | off` with radius and a one-shot empty-fallback retry.

**Approval pattern.** 18 existing approve/reject workflows. The reusable shape is `status text CHECK ('pending','approved','rejected') + approved_by + approved_at` with `POST …/:id/approve` and `…/:id/reject` — already used by `creator_product_images`, which is the closest analogue to post moderation.

**Governance.** `qa/scripts/governance-check.mjs`, 5 rules: contract required for governed paths, release evidence, **mockup-lock for UI changes**, before/after diff notes, Maestro-green for mobile releases.

---

## 2. 🟡 AMBER — exists, needs extension

### 2.1 The Discover layout is ~70% already renderable

`Packages/Mobile/src/components/SectionRenderer.js` (691 LOC) + `components/sections/TileSection.js` (496 LOC) already have the pieces:

| Mockup element | Code today | Gap |
|---|---|---|
| Section title + *See all* | ✅ every rail | — |
| **Chip row** | ✅ `ChipRow` (SectionRenderer:135-152), `shelf_type='controls'` | **Chips are display-only — not tappable, no filter state, no handler.** Seeded for `category`/`offers`/`creator_store`, *not* for `home` |
| **Banner carousel + page dots** | ✅ `TileSection` styles `hero_slider` (paged, autoplay, dots) and `fullbleed` (paged, dots) | Only under `shelf_type='tiles'` |
| Banner with text overlay + count line | 🟡 `BannerGateway` renders one banner + 3 thumbs, no carousel | Needs a count field |
| Section = title + chips + banner carousel | ❌ | **The composite is never assembled anywhere** |

10 tile styles already whitelisted server-side: `carousel, featured, grid, banner, mosaic, themed_rail, hero_slider, strip, split, fullbleed`.

**Notable:** the mockup's Jeans chips (Skinny / Wide Leg / Straight Fit / Mom Fit / Cargo) map almost 1:1 onto the **existing** Fit facet for the Jeans leaf — `Skinny|Slim|Straight|Bootcut|Mom|Boyfriend|Wide` (`fashion_facets.draft.csv`). Facet-value filtering already works at `GET /listing/nodes/:id/products?f_fit=Wide`. Chip → facet is data-ready; it just isn't wired into the section engine (`library_products` filters only `facets.brand`).

### 2.2 `library_products` — 80% of a Concept

Supported `rule_json` today (validated in `sectionLibrary.service.js:28-83`, SQL in `sectionRules.service.js:940-1005`):

`subcategory_node_id` (recursive subtree) · `tags[]` (AND) · `exclude_tags[]` (OR) · `product_ids[]` (hand-pick, order preserved) · `price_min` / `price_max` · `brand` (catalogue brand facet) · `has_offer` · `min_discount_pct` · `sort`

**What a Concept needs that this cannot do:**

1. **Filter by offer TYPE.** `has_offer` is type-blind; `min_discount_pct` hard-codes `bo.offer_type='discount'`. So "BOGO Jeans" is **not expressible**. The extension point is `OFFER_APPLIES` (`sectionRules.service.js:200-216`) — already hierarchy-aware; it needs one `bo.offer_type = $n` predicate.
2. **Post-offer price band.** `price_min/max` filter `bp.price`, the **pre-offer** price. "Under ₹499" therefore means pre-discount, contradicting the locked rule that price reads the effective price. No post-discount price predicate exists anywhere.
3. **Generic facet filtering.** Only `facets.brand` is supported in the rule engine, though the listing endpoint has full facet filtering.
4. **Templates.** `section_library.name` is a free string. No template/token concept exists. (Its own migration uses `"Jeans Under ₹499"` as the example name — the shape was anticipated.)

### 2.3 Other ambers

- **PDP** (`getProductDetail`, `follower.controller.js:1394-1451`) returns name/price/images/variants/facets/tags/stock — **no offer data at all**. Discount reaches the screen from the section item or a separate `/follower/store-offer/:id` call.
- **Search** — one endpoint, defaults to `super='eat'` (restaurants), searches brands + product names only, **not creators, offers or categories**, and its only client (`DiningSearchScreen`) is an orphaned route. The Home search bar goes to a static category browser instead.
- **Media** — R2 presign + download works; the "stable URL" pattern (`GET /v1/media/assets/:id` → 302 to a fresh presigned GET) is the right model to copy for post media. But: **no creator-scoped presign exists** (`POST /influencers/me/assets` accepts an `r2_key` the creator has no way to obtain), **no R2 delete function at all**, and crop-to-frame is **web-only** — mobile uses raw `react-native-image-picker` with no crop.
- **Follows** — `follower_follows(follower_id, influencer_id)` only. **No brand-follow table or endpoint anywhere.**
- **Telemetry** — `section_events` records `tap` / `see_all` at section level. No per-item impressions, views, dwell, saves or shares. `follower_saved_offers` saves **offers, not products**.
- **Reviews** — exist, but only rendered on the restaurant screen; no product-level review UI.
- **Deliverable presign** is the only video-capable upload; it has **no size cap**, and its MIME check only compares the top-level type so any `video/*` passes.

---

## 3. 🔴 RED — does not exist

| Need | Reality |
|---|---|
| `creator_posts` entity | Not found. ⚠ `posts` (mig 025) is **scraped Instagram analytics** — the name is taken. |
| `post_media`, `post_products` | Not found. |
| **x/y coordinate tagging** | **Zero** `x_pct` / `y_pct` / `hotspot` / `tag_position` columns or fields anywhere in migrations, backend, or mobile. |
| `concepts`, `concept_templates`, `collections` | Not found in any form. |
| Post-returning rules | All 26 rules in `sectionRules.service.js` return products, offers, brands, creators or categories. **None return content.** |
| Posts tab | Not found — no screen, no endpoint. |
| Videos tab | `ReelsScreen.js` is **38 lines of static placeholder text**. The `reels` table (mig 081) has **zero** controllers, routes or services — dead schema. |
| Video pipeline | No ffmpeg, no transcode, no thumbnail extraction, no duration column, no HLS/DASH, no range proxy. Video is stored raw. |
| Post moderation queue | Not found. `reels.status/approved_by/approved_at` columns exist with no code path. |
| Creator Discover builder | Creators have no layout ability — every layout/section/theme endpoint is admin-gated. |
| Per-post engagement | No likes/comments/shares/saves on any content entity. `reel_likes` exists, unused. |
| Product-level wishlist | Saves are offer-level only. |
| `/v1/media/creator-asset/:id` | Referenced by `creatorImagery.service.js:27` — **the route does not exist**; it would 404. |

---

## 4. Blockers, ranked

### 🔴 #1 — Allocation cannot express a category

**This is the one that blocks step 2 of the post composer.**

`follower.service.js:205-217`:

```js
if (scope === 'category') { params.push(cfg.category); sql += ` AND section = $2`; }
```

`brand_products.section` is set to the **mid-level category name** (`"Bottomwear"`) by the drill-down flow. It cannot distinguish Men from Women and **cannot reach a leaf**. So "brand allocates the Jeans category to this creator" is literally not expressible today — the finest grain available is Bottomwear. The campaign wizard's category dropdown is populated from those same strings and **never writes `category_node_id`**.

Meanwhile concepts bind to leaves. Left unfixed, the composer's step-2 product universe is wrong.

**The fix is already proven elsewhere.** The *offer* path was upgraded to node-based subtree matching: `brand_offers` writes `category_node_id` (via `OfferBuilder.js` CategoryPicker), and `OFFER_APPLIES` / `filterItemsByScope` walk the recursive subtree. That pattern needs to be carried into `campaign_influencers.offer_config_json` — plus `offerConfig.validator.js:78-80` currently *rejects* `category_node_id` alone, requiring the legacy string.

**Second-order:** legacy products created outside the drill-down flow have `category_node_id = NULL`. Concept filtering will silently skip them.

### 🔴 #2 — Concept rules cannot express two of the five families

Offer concepts ("BOGO Jeans") are **not expressible** — no offer-type predicate. Price concepts ("Under ₹499") filter the **pre-offer** price, which contradicts the locked rule. Both are surgical fixes inside `sectionRules.service.js`, not rewrites.

### 🔴 #3 — Nothing renders or returns content

26 rules, zero return posts. The follower app has no post entity, no feed, no coordinate tags, no video player. This is the bulk of the build, and it is genuinely new — but it is *additive*, not a rewrite: the section engine's config/context/ranking/caching machinery is reusable verbatim by swapping what a rule returns.

### 🟡 #4 — Verify the taxonomy actually landed in prod

`backend/scripts/seed-fashion-taxonomy.js` is a **manual script, not a migration** — it is not in `backend/migrations/` and does not run in the migration chain. Its own contract records the deploy step as *"095 then seed-fashion-taxonomy.js"*, and `02-workflow.md` says **185 leaves**, while the CSV now holds **195**. Prod may be stale or unseeded. Must be checked before anything depends on leaf ids.

### 🟡 #5 — Media plumbing gaps

No creator-scoped presign; no R2 delete (objects orphan on row delete); no mobile crop; no video handling of any kind. A carousel post with 6 slides × N tagged products has no upload path today.

---

## 5. End-to-end wiring trace

What has to happen for one post to reach one follower, hop by hop:

| # | Hop | Today |
|---|---|---|
| 1 | Brand lists products into leaves | 🟢 exists |
| 2 | Brand creates offers | 🟢 exists |
| 3 | Brand allocates store / **category** / products to creator | 🟡 store + products fine; **category is free-text and cannot reach a leaf** |
| 4 | Admin defines concept templates | 🔴 nothing |
| 5 | Creator picks scope → concept | 🔴 nothing |
| 6 | Backend filters the universe by the concept | 🟡 `library_products` does most of it; offer-type and post-offer price missing |
| 7 | Creator uploads image/video carousel | 🔴 no creator presign, no video pipeline |
| 8 | Creator taps the image to place product tags | 🔴 no coordinate storage anywhere |
| 9 | Creator publishes; admin approves | 🔴 no entity, no queue (pattern proven 18×) |
| 10 | Admin builds a banner attached to a concept | 🟡 App Builder exists; must be re-pointed at concepts and posts |
| 11 | Banner auto-fills with matching posts, ranked | 🟡 engine + context + ranking + caching reusable; **no post-returning rule** |
| 12 | Follower opens Discover, sees chips + banner carousel | 🟡 both primitives exist; chips inert; composite never assembled |
| 13 | Follower taps a banner → concept post feed | 🔴 no feed screen |
| 14 | Follower sees floating tags rendered at runtime | 🔴 nothing |
| 15 | Taps a tag or Shop-this-post → product | 🟡 PDP exists but returns no offer data |
| 16 | Bag → checkout → payment → order | 🟢 exists |
| 17 | Sale attributed to the creator, commission credited | 🟢 exists |
| 18 | Post goes dark when eligibility hits zero; creator notified | 🔴 no eligibility resolver; 🟢 notification infra ready |

**Reading:** the two ends of the chain are solid. The break is the middle — hops 4-15.

---

## 6. Landmines

1. **`posts` is taken.** Use `creator_posts`.
2. **Two category linkages coexist.** `category_node_id` (FK, hierarchy-aware) *and* free-text `section`. Different code paths use different ones. Legacy products have the FK NULL.
3. **Two offer-type vocabularies.** `brand_offers` uses `discount|volume|bogo|bundle|free_gift`; the legacy campaign enum uses `flat|percentage|bogo|bundle|volume|prebook`. Bridged only at runtime by `normalizeOfferType()`.
4. **Two variant models.** The drill-down flow writes `variants_json`; `product_variants` is a parallel older table. Per-variant price lives in both.
5. **Two price computations.** One JS resolver for money, one SQL mirror for card badges — deliberately duplicated.
6. **`GET /follower/store-offer/:id` skips the live gate** — checks only `status='active'`, not `published_to_store` or the date window.
7. **`section-results` does not validate inline `rule_json`** — it is `JSON.parse`d and passed straight through, bypassing `validateRule`.
8. **No R2 delete anywhere.** Media rows delete; objects orphan.
9. **Location default is hardcoded Vijayawada** (`LocationContext.js:24-31`).
10. **No staging backend.** Prod-as-staging; only an Android `follower.staging` flavor exists.
11. **10 vertical-specific follower screens** (8 food, 2 car rental) plus food fields (`veg_flag`) travelling through generic payloads.

---

## 7. Numbers

| | |
|---|---|
| Fashion leaves seeded (CSV) | **195** (4 segments, 35 categories, 234 nodes total) |
| Fashion facet definitions | **125** across 46 scopes |
| Section rules implemented | **26**, all product/offer/brand/creator/category — **0 content** |
| `sectionRules.service.js` | 1,412 LOC |
| Follower screens | **40** (10 vertical-specific) |
| Creator screens | **26** (12,623 LOC) |
| Admin routes | **32** |
| Notification types | **48**, OneSignal wired |
| Tile layout styles | **10** whitelisted |
| Approve/reject workflows to copy from | **18** |
