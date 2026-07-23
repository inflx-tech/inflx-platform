# Post/Concept Architecture — Dashboard Review + Phased Build Plan

**Status:** PROPOSED · 2026-07-23 · awaiting founder approval
**Reads with:** POST_CONCEPT_MODEL.md (architecture) · CONTROLS_MAP.md (surface classification) · BUILD_READINESS.md (code reality)
**Supersedes:** IMPLEMENTATION_PLAN.md (old 37-screen program — dead per founder ruling)

---

## PART A — Dashboard review: required vs present

### A1. BRAND dashboard (brand-web + brand mobile)

| Required for the new model | Present? |
|---|---|
| Register / login / subscription | ✅ |
| List products into the tree | ✅ |
| Create offers (5 types, scheduled) | ✅ |
| Campaign → negotiate → contract → deliverable | ✅ |
| Allocate whole store | ✅ |
| Allocate specific products | ✅ |
| **Allocate a product TYPE (leaf, "Jeans")** | ❌ — picker only offers broad groups ("Bottomwear"); backend matches free text |
| Anything else | **Nothing.** Brand needs NO new dashboards. |

**Brand verdict: one repair (leaf-level allocation picker + backend), zero new screens.**

### A2. ADMIN dashboard (brand-web /admin)

| Required | Present? |
|---|---|
| Accounts, payouts, escrow, orders, returns, tax, pricing, referrals, marketing | ✅ keep untouched (17 routes) |
| Shopping tree + tags + category images + world/location rules | ✅ keep (+ verify prod seed) |
| **Concept Template Manager** (47 templates × families) | ❌ new |
| **Concept Inspector** (open concept → post count by creator) | ❌ new |
| **Collection vocabulary list** | ❌ new |
| **Post moderation queue** (approve/reject creator posts) | ❌ new (pattern proven 18×) |
| **Discover Builder** (layout → chips → banners → concept, for Global Home) | ⚠️ App Builder exists but fills sections with PRODUCTS; must be re-pointed at posts + concept refs |
| **Brand Store template** (one design for all brands) | ⚠️ business scope exists in engine; template must be rebuilt post-first |
| Design system / themes / experience templates (System B) | ❌ NOT required — DELETE (4 pages, 7 empty tables, ~1,900 LOC) |
| Food pages (dish groups, master dishes, meals) | ❌ NOT required — HIDE (vertical parked) |
| Dead pages (follower-categories stub, home-builder, orphan section-library) | ❌ NOT required — DELETE |

**Admin verdict: 4 new dashboards, 2 rebuilds, ~10 removals, 20 keep.**

### A3. CREATOR dashboard (mobile influencer app)

| Required | Present? |
|---|---|
| Offers → negotiate → contract → deliver → earnings → withdraw | ✅ keep whole loop (20 screens) |
| See allocated products per campaign | ⚠️ exists; re-point as allocation viewer, drop product notes |
| **Post Composer** (scope → concept → media → coordinate tagging → tag style → submit) | ❌ new — the single biggest build |
| **Creator media upload** (images + video, carousel) | ❌ no creator-scoped upload path exists |
| **My Posts** (status: pending / live / dark + reason) | ❌ new |
| **My Discover builder** (chips + banners over own posts) | ❌ new — creators have zero layout ability today |
| **Post performance** (views, taps, shop-opens, sales per post) | ❌ new — creators can see money only, nothing else |
| Experience Studio, MyStore, StockStore | ❌ NOT required — DELETE (orphans / replaced) |

**Creator verdict: keep the earning loop, delete 3 screens, build 5 new surfaces.**

### A4. FOLLOWER app

**Front end: 100% fresh.** All 40 existing screens discarded (10 are food/car anyway). Founder supplies every screen design.

Backend kept and re-used: auth/OTP, location capture + per-world location rules, follows (creators), section engine (config/context/ranking/caching), catalogue browsing + facets, bag → Razorpay → orders → returns → wallet, creator attribution (link/window/coupon), notifications/push.

| Required for the new experience | Present in backend? |
|---|---|
| Home with Discover / Posts / Videos tabs | ❌ no posts, no feeds |
| Sections = title + tappable chips + banner carousel with counts | ⚠️ chip row exists (display-only), banner carousel with dots exists; composite never assembled; counts don't exist |
| Banner → concept post feed | ❌ no post-returning rule exists (all 26 rules return products/offers/brands/creators) |
| Post viewer with runtime floating tags | ❌ no coordinate storage anywhere |
| Shop-this-post sheet → PDP | ⚠️ PDP exists but returns zero offer data |
| Video feed + shop-this-video | ❌ reels dead schema; no video pipeline |
| Creator store (content-first) / Brand store (single-brand posts) | ❌ current stores are product/offer grids |
| Collections surface | ❌ |
| Search (creators + concepts + products) | ⚠️ food-defaulted, no creators, orphaned screen |
| Follow brands / save products / like-save posts | ❌ creators-only follows; offer-only saves; no post engagement |

---

## PART B — Phased implementation plan

Rule of sequencing: fix the ground first, then the language (concepts), then the content (posts), then the shop window (follower app), then discovery, then video, then intelligence. Every phase ends with something a human can see working.

### PHASE 0 — Ground repair (foundation, no visible features)
Work: verify prod taxonomy (195 leaves) + count/backfill products with no tree link; leaf-level category allocation end to end (brand picker writes tree node; backend resolves subtree; old free-text still honoured); offer-type + effective-price predicates added to the rule engine; delete System B + dead admin pages + hide food pages; delete 3 dead creator screens.
**Functional output:** a brand can allocate exactly "Jeans" to a creator and the creator sees exactly the right products. Rules can answer "BOGO products" and "under ₹499 AFTER discount". Dashboards are clean of dead weight. Nothing new visible to followers.

### PHASE 1 — The concept language (admin)
Work: concept-template tables + generated concepts (template × leaf); Concept Template Manager dashboard; collection vocabulary dashboard; live product-preview per concept ("Jeans Under ₹499 → 42 products right now").
**Functional output:** admin defines ~47 templates once and ~9,200 concepts exist automatically; admin can open any concept and see the live matching products. This is the dictionary everything else reads. Nothing visible to followers yet.

### PHASE 2 — Creator posts exist (creator + admin)
Work: `creator_posts` + media + product-tag tables (with x/y); creator-scoped image upload (multi-slide) with mobile crop; Post Composer v1 — scope → concept-or-collection → upload → tap-to-tag → tag style → submit; admin Post Moderation Queue; My Posts list with statuses. IMAGE POSTS ONLY (video is Phase 5).
**Functional output:** a creator publishes a fully tagged image post; admin approves it; it sits live in the database with a concept attached. End of the creator's core new journey. Followers still can't see it — by design, the follower app lands next.

### PHASE 3 — Fresh follower app, first purchase (follower)
Work: new follower app shell from founder's screens (fresh navigation, fresh look); post viewer with runtime floating tags + Shop-this-post sheet; PDP upgraded to include offer data; bag → checkout re-skinned over the EXISTING payment/order/attribution backend; a plain Posts feed (newest/approved) so posts are reachable before Discover exists.
**Functional output:** the first end-to-end sale of the new world — follower opens app → sees creator posts → taps a floating tag → buys → creator gets commission. The business model works in the new architecture, even before Discover.

### PHASE 4 — Discover (admin + follower)
Work: post-returning concept resolver with the LIVE eligibility test (post visible while ≥1 product still qualifies; goes dark + creator notified at zero); banner/chips/section composite renderer (tappable chips, banner carousel, live post counts); admin Discover Builder re-pointed at concepts; Global Home assembled; Brand Store template (single-brand-scoped posts); Concept Inspector; ranking v1 = follows + distance + recency.
**Functional output:** the full discovery loop — admin attaches a banner to "Winter Jeans" once; every matching post from every creator fills it automatically, forever; follower taps banner → concept feed → shops. Brand stores fill themselves. Posts that stop qualifying vanish honestly.

### PHASE 5 — Creator's own world (creator + follower)
Work: creator Discover builder (same grammar, own content only); content-first creator store; Collections end to end (admin vocabulary → creator picks at publish → follower Collections surface); post performance dashboard for creators (needs per-post events from Phase 4's surfaces).
**Functional output:** each creator curates their own storefront; followers browse a creator's world; collections ("Airport Look") appear across creators; creators finally see how their content performs, not just what it earned.

### PHASE 6 — Video (creator + follower)
Work: video upload (size/duration caps) + thumbnail + playable feed; video post type in composer (checked product list, no coordinates); Videos tab + Shop-this-video sheet; video posts join concepts/banners/feeds everywhere.
**Functional output:** creators publish shoppable videos; followers scroll a vertical video feed and buy from it. Deliberately last: image posts prove the model with a fraction of the infrastructure risk.

### PHASE 7 — Intelligence & depth (all)
Work: per-post likes/saves/shares; product wishlist; brand follows; real search (creators + concepts + products); personalised ranking using accumulated engagement; trust-tier auto-approve for proven creators; admin analytics on concepts/posts/banners.
**Functional output:** the app gets smarter with use — feeds personalise, search finds everything, admin sees what's working, high-volume creators stop waiting in the moderation queue.

---

## Dependency logic (why this order)
- 0 before everything: concepts bind to leaves; composer step 2 needs correct allocation; rules need the two new predicates.
- 1 before 2: composer step 2 requires concepts to exist.
- 2 before 3: follower app needs posts to show.
- 3 before 4: prove the purchase loop before building navigation; Phase 4's counts/eligibility surface an already-working commerce path.
- 5 after 4: creator Discover reuses Phase 4's composite renderer; post analytics needs Phase 4's event stream.
- 6 isolated: video adds infra risk, zero model risk — parks cleanly at the end.
- 7 continuous: everything there is additive tuning on live data.
