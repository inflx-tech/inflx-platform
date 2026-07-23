# Admin + Creator Controls — Map against the Post/Concept architecture

**Status:** analysis · 2026-07-22 · no code changed
**Reads with:** `POST_CONCEPT_MODEL.md` (the target architecture)
**Method:** full code inventory of `Packages/brand-web/app/admin/` (32 routes), `backend/src`, and `Packages/Mobile/src/screens/influencer` (26 screens).

---

## 0. Headline findings

1. **Two non-converged SDUI systems exist under one nav header.** System A (`section_config` + `section_library`) is live and renders to followers. System B (design tokens → presets → themes → layouts → templates → creator experiences, migrations 127-136) is fully authorable by admin and **invisible to every follower** — each of its migrations says "ships EMPTY / deploy-inert" in its own header. ~1,900 LOC + 7 tables + 4 admin pages + 1 creator screen produce nothing a user can see.
2. **The Concept engine is not a from-scratch build.** `section_library.rule_json` already filters by *category subtree + price band + has-offer + min-discount% + tags + brand + sort*, implemented in `sectionRules.service.js:878-1000`. It is ~80% of a Concept. It is missing: offer **type** matching, first-class naming/vocabulary, and a resolver that returns **posts** instead of products.
3. **Store-wide and category-wide allocation already exist** — `follower.service.js:205-217`, driven by a "Whole store / Category / Products" toggle the brand already uses. But "category" there means `brand_products.section` (free text), while Concepts bind to `category_nodes`. **These two must be reconciled or concept matching will silently under-return.**
4. **There is no post entity, and the obvious name is taken.** `posts` already exists (migration 025) holding *scraped Instagram analytics*. The new entity must be `creator_posts`.
5. **The creator app has zero content-creation ability today.** The only media uploader (`DeliverableScreen`, 799 LOC) is campaign-deliverable-scoped, has no product attachment, and is reachable only via push notification. `creator_assets` is flag-gated off and its image URL route (`/v1/media/creator-asset/:id`) **does not exist** — it would 404 if enabled.
6. **Admin has no creator-content moderation of any kind.** `/admin/approvals` is brand/influencer *account* approval only. Post approval is a net-new surface.

---

## 1. ADMIN — all 32 routes classified

### 1.1 KEEP UNTOUCHED — 17 routes (commerce, money, ops)

Nothing in the new architecture touches these. They are the working platform.

| Route | Controls |
|---|---|
| `/admin/analytics` | Platform GMV/campaign/signup time series |
| `/admin/approvals` | Brand + influencer **account** approval queue |
| `/admin/billing/invoices` | Subscription invoices |
| `/admin/brands` | Brand list, platform fee %, commission override, feature entitlements |
| `/admin/escrow` | Escrow oversight + manual tranche release |
| `/admin/influencers` | Bulk upload, TDS controls, re-scrape |
| `/admin/marketing/*` (7 pages, 2072 LOC) | Outbound lead CRM, creator verification, invitations |
| `/admin/orders` | Order list, commerce summary, status transitions |
| `/admin/payouts` | Influencer + brand withdrawal queues |
| `/admin/pricing/*` | Tiers, feature matrix, prices, marketplace categories |
| `/admin/production-queue` | In-flight content production events (read-only) |
| `/admin/referrals/*` | Referral settings, edges, ledger, agencies |
| `/admin/returns` | Return/refund queue |
| `/admin/settings/payments` | Platform fee, escrow %, GST/TCS/TDS |
| `/admin/subscriptions` | Active brand subscriptions |
| `/admin/tax-summary` | Monthly GST/TCS/TDS filing view — **orphan, needs a nav entry** |
| `/admin/users` | Admin users, roles, capabilities |

### 1.2 RETIRE — food vertical, 3 routes (~900 LOC)

Fashion-only pivot parked the other verticals ~6 months. These are food-only and one is already orphaned.

| Route | Note |
|---|---|
| `/admin/dish-groups` | Already orphan — no nav entry, no link |
| `/admin/master-dishes` | 619 LOC — canonical dish catalogue + dish review queue |
| `/admin/meals` | 3 global delivery numbers |

*Recommendation: hide from nav, do not delete.* The food listing engine is intact and these come back when the vertical does.

### 1.3 DELETE — dead, duplicated, or follower-invisible

**(a) Dead / duplicated — 3 routes**

| Route | Why |
|---|---|
| `/admin/follower-categories` | Retired stub that redirects to `/admin/sections`; duplicated the same table |
| `/admin/home-builder` | Orphan; identical endpoints already reachable via App Builder "⚙ Manage worlds" |
| `/admin/section-library` | Orphan; the same rule builder is embedded inside App Builder |

Also dead in the DB: `collection_library` (migration 104) — **zero references in `backend/src`**; `reels` + `reel_likes` (migration 081) — zero references.

**(b) The Creator Experience Engine — 4 admin routes, ~1,900 LOC, 7 tables, follower-invisible**

This is the "design related" cruft you sensed. It was built to let admin compose visual identity; the new model needs none of it — Discover is one fixed chip layout and you are supplying every screen yourself.

| Layer | Objects | Verdict |
|---|---|---|
| `/admin/design-system` (182 LOC) | `design_tokens` (~50 seeded), `design_presets` | Read-only catalogue viewer. **Nothing on a follower path reads these.** Background assets were never even produced (`asset_r2_key = null`). |
| `/admin/design-library` (106 LOC) | `design_layouts` (10 seeded slot contracts) | Read-only viewer. Read by System B only. |
| `/admin/themes` (281 LOC) | `experience_themes` (fashion blueprints seeded) | Writes real rows. **No follower surface renders them.** Note: a "theme" here carries *no price filter and no query* — it is a brief, not a rule. It is **not** a Concept and cannot be promoted into one. |
| `/admin/experience-templates` (195 LOC) | `experience_templates`, "Place" → `section_config` row | **Ships empty.** The `experience_template` rule (`sectionRules.service.js:1387`) returns `[]` unless published `creator_experiences` exist. |

Backend to retire with it: `experience.service.js` (239), `template.service.js` (159), `theme.service.js` (151), `renderSpec.service.js` (92), `adminExperiencePreview.controller.js` (91), `adminDesignSystem` (81), `adminTemplates` (58), `adminThemes` (57), `adminDesignLayouts` (57). Mobile: `ExperienceStudioScreen.js` (139), `AdaptiveRenderer.js`, `sampleSpecs.js`.

Tables: `design_tokens`, `design_presets`, `design_layouts`, `experience_themes`, `experience_templates`, `creator_experiences`, `experience_products`.

*All seven tables ship empty by their own migration notes, so dropping them is data-safe.*

### 1.4 KEEP AND ADAPT — 3 routes

| Route | Change |
|---|---|
| `/admin/category-images` | Keep. Add the `concept_eligible` toggle here — it already walks the `category_nodes` tree and writes `meta`. |
| `/admin/world-rules` | Keep, reduced to one world (fashion). Still governs location boundary/radius/fallback, which the banner ranking rule needs. |
| `/admin/tag-vocabulary` | **Decision needed.** Tags fed `section_library` rules. The 5 concept families are category/price/offer — tags are not in the model. Either keep tags as an internal concept-definition aid, or retire them. |

### 1.5 REBUILD — 2 routes

| Route | Change |
|---|---|
| `/admin/sections` — App Builder (2090 LOC) | The **composer idea survives, its content model inverts**. Today a shelf resolves to *products*; it must resolve to *posts*. Roughly 25 rules in `sectionRules.service.js` (1412 LOC) all return products. This becomes the **Global Discover Builder**: layout → chips → banners → concept ref + media filter + pinned posts. |
| `/admin/custom-pages` | Folds into the Discover Builder unless you want standalone pages. |

### 1.6 NET-NEW admin surfaces — 6

| # | Surface | What it does | Seed to build on |
|---|---|---|---|
| 1 | **Concept Manager** | CRUD the concept vocabulary across the 5 families: name, family, category node, price band, offer type. The heart of the system. | `section_library` rule builder — already does category+price+has-offer with a live preview |
| 2 | **Collection Vocabulary** | The admin-published list of collection names creators pick from | `creator_lookbooks` (live API, no UI anywhere) |
| 3 | **Post Moderation Queue** | Approve / reject creator posts — you ruled admin-only approval | Pattern exists in `/admin/approvals` and the brand deliverable review flow |
| 4 | **Concept Inspector** | *Your explicit requirement:* open a concept, see how many posts sit under it, by creator. Drives what you promote on Global Home. | Nothing — new |
| 5 | **Global Discover Builder** | Layouts → chips → banners → concept/collection + media filter + pins | Rebuild of App Builder |
| 6 | **Brand Store Template** | One admin-designed template reused for every brand, filled with that brand's single-brand-scoped posts | `section_config` already supports `screen='business'` |

---

## 2. CREATOR APP — all 26 screens classified

Total creator screen code today: **12,623 LOC**.

### 2.1 KEEP UNTOUCHED — 20 screens (~10,700 LOC)

The entire "get work → do work → get paid" loop is sound and orthogonal to the new model.

Offers (list, detail), Negotiation, Contract + sign + PDF, My Contracts, My Campaigns, Campaign Detail, Campaign Completion, Deliverable List / Detail / Upload, Earnings, Commission Detail, Refer & Earn, Profile + payout, Proposals Hub, Send Proposal, Notifications, Brand Profile.

### 2.2 RE-POINT — 2 screens

| Screen | Change |
|---|---|
| `HomeScreen` (470) | Remove the "Create Experience" tile; becomes the entry to Creator Studio (Create Post / My Posts / My Discover) |
| `CampaignProductsScreen` (402) | Per-product "recommendation notes" (`influencer_product_notes`) are superseded by posts. Keep as the *allocation viewer* ("what may I promote"), drop the notes. The "Publish to Store (X/Y)" badge is already mislabelled — it counts notes, not published products. |

### 2.3 DELETE — 3 screens

| Screen | Why |
|---|---|
| `ExperienceStudioScreen` (139) | Replaced by the Post Composer. Its whole backing engine is being retired. |
| `MyStoreScreen` (242) | Orphan (zero navigate callers). The creator store is being rebuilt content-first anyway. |
| `StockStoreScreen` (167) | Orphan-of-an-orphan. Its table `influencer_store_inventory` **has no read path at all** — `resolveStore` never queries it, so creators stock a shelf nothing renders. |

### 2.4 RELINK — 1 screen

`TransactionFeedScreen` (203) — orphaned but genuinely useful (follower purchases attributed to you). Fold into Earnings rather than delete.

### 2.5 NET-NEW creator surfaces — 6

| # | Surface | Note |
|---|---|---|
| 1 | **Post Composer** | The 4-step flow: scope → concept-or-collection → media → products. The single biggest build in the program. |
| 2 | **Creator media pipeline** | Image + video, multi-slide carousel. Today the only video-capable presign is deliverable-scoped (`POST /deliverables/:id/upload-url`). A creator-scoped, product-attachable upload endpoint does not exist. |
| 3 | **My Posts** | List + status (submitted / approved / live / dark) + the "no longer matches your concept" notice from the eligibility rule |
| 4 | **My Discover Builder** | Creator builds layout → chips → banners inside their own store. Creators have **zero** layout ability today. |
| 5 | **Creator store preview** | Content-first rebuild of the retired MyStore |
| 6 | **Post performance** | Views / taps / shop-opens / conversions per post. **Creators have no content analytics whatsoever today** — `creatorAnalytics.controller.js` is brand-gated, and the documented `GET /influencers/me/insights` does not exist. Without this creators fly blind. |

---

## 3. Backend work implied

**New tables:** `concepts`, `collections`, `creator_posts` (⚠ not `posts` — taken by scraped IG data), `post_media`, `post_products`, `discover_layouts` / `discover_chips` / `discover_banners`.

**Extend:** `category_nodes` — add `concept_eligible` (or use the `meta` jsonb already in use for images).

**Rewrite:** `sectionRules.service.js` (1412 LOC) — every rule returns products; the new surfaces need post-returning resolvers plus the live eligibility test.

**Reconcile (real risk):** campaign allocation's `scope='category'` matches `brand_products.section` (free text); Concepts bind to `category_nodes` ids. Left unfixed, a creator allocated "a category" will see the wrong product universe at step 2 of the composer.

**Fix or delete:** `creatorImagery.service.js:27` returns `/v1/media/creator-asset/:id`, a route that does not exist. `routes/withdrawal.routes.js` and `routes/wallet.routes.js` are never mounted.

**Untouched:** listing engine, offer engine (all 5 types), commission/attribution, transactions/wallet, escrow, campaigns, contracts, returns.

---

## 4. Scoreboard

| | Keep | Retire/park | Rebuild | New |
|---|---|---|---|---|
| **Admin routes** (32) | 20 | 10 | 2 | 6 new surfaces |
| **Creator screens** (26) | 20 | 3 | 2 re-pointed, 1 relinked | 6 new surfaces |
| **Backend** | listing, offers, commission, money, campaigns | ~1,900 LOC System B + 7 empty tables | `sectionRules` post resolvers | concepts, posts, discover |

Roughly **two-thirds of the admin panel and three-quarters of the creator app are untouched by this pivot.** The change is concentrated exactly where it should be: content creation, concept vocabulary, and discovery.

---

## 5. Decisions needed

1. **Delete or archive System B** (7 tables, ~1,900 LOC)? All ship empty — deletion is data-safe. Recommendation: delete, do not carry.
2. **Tag vocabulary** — keep as an internal aid to concept definition, or retire? Tags are not in the 5 families.
3. **Food routes** — hide from nav (recoverable) vs delete. Recommendation: hide.
4. **Allocation category axis** — migrate `scope='category'` from `brand_products.section` to `category_nodes`, or keep both and map? This one blocks the composer's step 2.
