# COMPLETE PROGRAM HANDOFF — INFLX listing ↔ follower (data + design)

> Paste this whole file (or point a fresh window to it) to continue ONE program
> with full context. Repo: `C:\WORK\inflx-platform`. Charter `GOVERNANCE.md` wins
> on any conflict. Authored 2026-06-08 at the end of a long session (memory full).
> This is the authoritative handoff — it covers what we COMPLETED, what we
> DEFERRED, and the follower-app work remaining on BOTH data and design.

---

## STEP 0 — READ BEFORE ANY CODE (in order)
1. `GOVERNANCE.md` (charter) + `CLAUDE.md` (operating rules + project reference).
2. `design/wave4-creator-vibe/AGREED-VS-BUILT-DIFF.md` — follower app screen-by-screen
   audit (agreed mockups vs built) + prioritized plan.
3. The agreed mockups (the design spec — match pixel-for-pixel):
   `design/wave4-creator-vibe/all-screens.html` + each `*-comprehensive.html`.
4. `design/wave4-creator-vibe/COMBINED-IMPLEMENTATION-PLAN.md` (listing↔section merge)
   + `features/_LISTING_ROADMAP.md` (the deferred other-business backlog).
5. Built mobile: `Packages/Mobile/src/screens/follower/*`, `components/SectionRenderer.js`
   + reused components (`CategoryGrid`, `InfluencerStoryRow`, `cards/ProductCard`,
   `cards/NewOfferCard`), `config/featureFlags.js`, `FollowerNavigator.js`.
6. Backend: `services/sectionRules.service.js`, `sectionEngine.service.js`,
   `follower.service.js`, `controllers/mediaAsset.controller.js`,
   `services/listing.service.js`, `public/schemas/*.json`.

**VERIFY-TWICE (mandatory):** read the actual file/migration before claiming any
route/column/component exists. Real behaviour beats any hypothesis.

---

## 1. THE PROGRAM (one spine)
A seller lists an entity (listing engine) → with no extra wiring it becomes
rankable/displayable → it appears in the right follower shelf with the right CTA
(`availing_modes`) and the 4-ID creator chain. "What you list == what you see."
The follower app is admin-controlled shelves (section engine) over listed entities.

---

## 2. WHAT WE COMPLETED THIS WINDOW (do not redo)

### 2a. Restaurant listing engine — COMPLETE + hardened
Restaurant is the proven **dictionary-mode** vertical (master catalogue → pick/scan →
autofill → own photo/price). Fixes shipped this session (commits on `main`, oldest→newest):
- `ab189bb` quality-score reads `listing_data` (was always 0/100).
- `2b7837f` dish **section persists** (restaurant.json storage_format) + prod backfill (21 dishes).
- `703c09b` **blank dish photos** + per-dish price/photo capture + **honest publish**
  (publishDriver now checks `res.ok`; no more fake "You're live" on rejected saves).
- `ee9db74` **build-while-pending** (dropped `requireApproved` on product writes;
  `resolveBusinessStore` guards `users.status='approved'`) + free Maps short-link location.
- `d72b151` **cuisines-in-menu** (inline "Add cuisine") + geocoding mock opt-in.
- `8520f80` **admin uploads stock images** for master dishes.
- `8bc5b49` **dictionary parity** (admin master-dishes = Cuisine→Category→Item drill-down)
  + restaurant "add your own item under {category}" tile.
- `1c5432f` media **CORP fix** (cross-origin `<img>` loads).
Contracts (all `released:true`): `listing-restaurant-edit-surfaces`,
`listing-restaurant-menu-cuisines`, `listing-stable-image-urls`,
`admin-master-dish-stock-upload`, `listing-dictionary-parity`.

### 2b. Section engine — listing-driven discovery LIVE (offer-independent)
Diagnosed: discovery was gated behind the live-offer chain, so a listed restaurant
with no offer was invisible — wrong. Fixed:
- `f572dba` + migration **088**: 3 new offer-independent rules
  (`businesses_in_category`, `products_in_category`, `creators_in_category_listing`);
  Category shelves re-pointed to them.
- `36f6551` + migration **089**: Home Eat shelves re-pointed (Home renders only when
  a DATA shelf has items — `hasEngineContent` ignores nav_tiles, so Home needed this).
Contract `follower-listing-driven-discovery` (released). Flags
`SECTION_ENGINE_HOME/CREATOR/CATEGORY/OFFERS = true`. **Follower OTA = v68.**
Live now (verified): `/follower/home` → 3 brands + 8 dishes + 7 tiles;
`/follower/section/category/dining` → Sagar + 3 restaurants + dishes — all WITHOUT an offer.

### 2c. Supporting infra
- **Stable image URLs**: uploads store `<RENDER_EXTERNAL_URL>/v1/media/assets/<id>`
  (re-sign R2 on read); never store raw 1h-signed URLs. Stock images: `/v1/media/stock/*`.
- Admin master-dish stock upload + restaurant own-photo upload both permanent now.

---

## 3. WHAT WE DEFERRED — other-business listings (FROZEN)
**Decision (founder): freeze all non-restaurant listing work until the follower app
is verified end-to-end for restaurant.** Then resume per `features/_LISTING_ROADMAP.md`.
- **Two listing modes:** Dictionary (restaurant ✓, electronics) vs **Drill-down**
  (fashion, furniture, jewellery, footwear) — a variable-depth category **tree +
  per-leaf facets**, drill-once-batch-add, no AI.
- **Locked vertical models (designed, NOT built):** fashion (drill-down, Showcase vs
  Sell), furniture (drill-down, Family axis, seed CSVs in `C:\WORK\furniture_*.draft.csv`),
  imitation jewellery (fixed price, not real gold), footwear (fashion+size), flowers+
  gifting (occasion axis, made-to-order+slot), electronics (dictionary, model+GTIN,
  Open-Icecat seed + flywheel), pet-shop (dual-mode).
- **Roadmap (all stubs):** #2 `listing-drilldown-taxonomy-engine` (the core net-new
  engine that #3/#5/#6 reuse) → #3 furniture → #4 electronics → #5 fashion → #6 fan-out
  (jewellery/footwear/flowers/pet) → #7 mobile seller (deferred).
- **Do NOT start these until restaurant follower verification is signed off.**

---

## 4. THE FOLLOWER APP — current state + what's left (DATA + DESIGN)
The follower app has TWO tracks. Both matter; the founder's **immediate priority is
DESIGN fidelity**, but the DATA gaps must be closed for full verification.

### 4a. DATA / functional track
DONE: listing-driven discovery (Home + Category) live; Business Page
(RestaurantDetail) reads the menu directly; Creator Store reads picks.
PENDING:
- **Offer-source mismatch (blocks the whole Offers half):** `campaign_offers` is EMPTY
  platform-wide even though the founder configured an offer in campaign creation — the
  offer intent lives at SET level (coupon_prefix SUMMER10), and `brand_offers` is also
  empty. Until reconciled into one model the shelves read, every offer shelf / discount
  badge / 4-ID attribution is empty. **Fix this before Offers verification.**
- **Sub-category chips** (Category screen) have no data → need brand sub-types / the
  drill-down taxonomy (roadmap #2).
- **Creator listing rules:** `creator_promotes` / `creator_top_picks` still offer-gated
  → make picks-based (like we did for category).
- **Attribution:** once an offer exists, verify a tap via the share link
  (`inflx.in/s/sagartravel?...`) lands a `follower_transactions` row with all 4 IDs + product_id.
- **Location + distance discovery (NEW, build-ready — `features/follower-location-distance/`):**
  Google Geocoding key is now set in Render. 4 layers — (1) fix brand coords persistence
  (`updateMe` uses `location.service.extractLatLng` which is short-link-blind → brands
  have NULL `lat/lng`; also a duplicate `latitude/longitude` vs canonical `lat/lng` column
  bug); (2) follower GPS capture (migration **090**: followers += last_lat/last_lng/
  area_name; `POST /follower/location` reverse-geocodes the area name); (3) distance
  ranking (inline Haversine in `businesses_in_category`/`products_in_category`, return
  `distance_km`); (4) mobile render "X km away" + area-name header. Influencers ranked by
  **city** (confirmed sufficient). Cost: Geocoding API only (device GPS + Haversine are
  free; NO Distance Matrix). Full verified spec in the contract. **Deferred to a fresh
  window (this one hit the memory edge) — build it end-to-end from the spec.**

### 4b. DESIGN track (the founder's immediate ask) — pixel-accurate rebuild
The build does NOT match the agreed mockups visually. WHY (verified in code):
- The Creator-Vibe work was an **overlay**, not a rebuild: a **color-only recolor
  shim** ("visual only, no logic changes") — colors changed, **layouts did not**.
- `SectionRenderer.js` **reuses OLD components** (CategoryGrid = square tiles,
  InfluencerStoryRow, ProductCard, NewOfferCard) → even the engine path renders old
  cards, not the mockup's round stories / round category circles / gradient deal cards.
  **The mockup components were never built in RN.**
- Navigation still points at legacy screens: `HomeScreenV2.js:~150` hard-codes
  `cat.key==='eat' → navigate('DiningHome')` (vibe-tiles screen), bypassing the agreed
  Category screen.
- The mockups were used for the **section catalog + palette**, not the **pixel spec**.
TASK: rebuild each screen's components to match the mockups exactly (round story
ring-avatars, round explore-category circles, Home header with profile-pic + bell,
gradient deal cards, trust lines, ranked "#1/#2" badges, the agreed Category/Business/
Product/Orders/Profile layouts); re-point navigation (Eat → agreed Category);
make `SectionRenderer` render mockup-accurate cards.

---

## 5. COMBINED IMPLEMENTATION PLAN (data + design, per the founder's order)
Build the follower app **screen by screen to the mockups**, closing the data gap for
each screen as you go. Suggested order + per-screen scope:
1. **Home** (DESIGN first, founder priority) — header (location + profile pic + bell),
   round stories, round explore-categories, mockup deal/brand/product cards; fix Eat
   routing → agreed Category. DATA already populated (listing-driven).
2. **Category (Eat)** — agreed layout (sticky sub-cat chips, creators→businesses→items→
   deals→all-list); DATA: wire sub-cat chips to real sub-types.
3. **Offers** — agreed layout (chips, Today's-Best hero, per-cat rails, By-Creator);
   DATA: **fix the offer-source mismatch first** (else empty).
4. **Creator Store** — agreed layout (profile, Collabs, Promotes, ranked Top-Picks);
   DATA: make creator rules listing/picks-based.
5. **Creator's Category** — agreed layout (partners, picks, ranked top).
6. **Business Page** — generalize to the admin-templated schema block model
   (restaurant ~80% there; wire Reviews; template the others).
7. **Product Detail** — agreed layout + the conditional **Customize/variants/size** block.
8. **Orders** — rich 5-type activity inbox (tracker/QR/tabs/month groups).
9. **Profile** — stats row + Wallet card + Refer&Earn + full menu.
Then **Reels (52.8)** last (needs APK).
Each screen: author/lock mockups (`04-preview/`, reference the comprehensive HTML) →
build → `06-diff/notes.md` → `pnpm qa` → OTA `pnpm publish-ota:follower` → verify
side-by-side against the HTML mockup. **After all screens verified for restaurant →
resume §3 other-business listings.**

---

## 6. TEST FIXTURE (real prod data)
- Brand: **Chaitanya Food Court** id `55a4e7ea-85ae-484d-a00d-91e9b2ce7cf7` · restaurant ·
  Vijayawada · approved · 10 dishes.
- Campaign: "New Campaign1" id `6ae00289-427b-40f9-af67-d2e77e44e577` · **active**;
  Set A id `3c0196d3-f2b8-4429-b681-1deeb232c31e` · coupon_prefix SUMMER10.
- Influencer: **Sagar Joshi** `sagartravel` id `070418e5-1374-40fa-9366-cc54ea1b44b6` ·
  120k · **contracted** · 5 picks · city null.
- **NO `campaign_offers` (0 platform-wide)** — the offer-source gap.

---

## 7. HARD INFRA / PROCESS FACTS (verified — carry forward)
- Prod backend = `https://inflx-platform.onrender.com/v1` (`api.inflx.in` STALE/404).
- `git push origin main` → Render auto-deploys backend; Vercel auto-deploys brand-web
  (= inflx.in + inflx.in/admin). Mobile via OTA (`pnpm publish-ota:follower`/`:all`),
  native → APK. **Follower OTA = v68.** LIVE admin = `Packages/brand-web/app/admin/`.
- **Next NEW migration number = `090`** (087 flywheel · 088 section-config-listing ·
  089 home-listing committed). Apply to prod: `ENV_FILE=.env.prod-backup node
  backend/scripts/run-0XX.js` (founder go). Prod DB read: `ENV_FILE=.env.prod-backup
  node -e '...'` from `backend/`.
- **GOTCHA — brand-web `lib/api.js` `request()` RESOLVES on non-2xx** (returns
  `{success:false}`, never throws) → callers MUST check `res.ok`/`res.success`
  (caused a silent data-loss bug).
- **GOTCHA — images:** store the stable re-sign URL, not raw signed R2 (expires 1h);
  media serve endpoints set `Cross-Origin-Resource-Policy: cross-origin`.
- **GOTCHA — `GEOCODING_MOCK` is opt-in** now (default off); paid Google auto-address deferred.
- **GOTCHA — `HomeScreenV2` `hasEngineContent` ignores nav_tiles** → Home needs a
  populated DATA shelf or it falls back + hides the category tiles.
- **GOTCHA — bash cwd resets** sometimes → `cd /c/WORK/inflx-platform` (or `/backend`) explicitly.
- Parallel-window git hygiene: shared tree → **stage by path, never `git add -A`**;
  another window may hold reels WIP (`081_*.sql`, `features/follower-shoppable-reels/`).
- Money = rupees · 4-ID on every actionable item · admin = `requireAnyAdminRole`.

---

## 8. GOVERNANCE / OPERATING DISCIPLINE
- Every unit of work = a `features/<slug>/` contract: spec → workflow → Step-5 lock →
  HTML mockups + workflow-prediction (UI-governed) → mockup-lock → impact → implement →
  `06-diff/notes.md` (UI-governed) → `pnpm qa` (+ `pnpm qa:maestro` on Mobile release) →
  explicit prod-go → record.
- **`governance-check.mjs` (pre-push) ENFORCES** for commits touching
  `Packages/*/(src|app|components|lib|screens|services)/`: approved contract +
  `mockup_locked:true` + non-empty `06-diff/notes.md`. Mobile release also needs
  `release.maestro_green:true` (Maestro = founder's emulator; if you can't run it,
  record honestly + rely on founder manual verify + smart-fallback).
- **`pnpm qa` is the GREEN gate** (Playwright web+api+unit, 79/79 + C1). `pnpm qa:db`
  informational (pre-red, never blocks). **No-fake-green is absolute.**
- Founder **delegates lock + design decisions** ("take best action, stop re-asking")
  BUT **production-impacting deploys are surfaced for explicit go and never silent**
  (announce them; don't re-ask permission for each — they've been saying go). The
  mockups ARE the locked design — build to them; still author `04-preview/` mockups +
  `06-diff/notes.md` to satisfy the gates.
- Before any pause: state what-done + what-next in plain functional language; keep
  impact verdicts terse.

---

## 9. SUCCESS CRITERION + MACRO SEQUENCE
**Now:** every follower screen renders AS its agreed mockup (round stories, round
categories, header with profile pic + bell, gradient deal cards, trust lines, agreed
layouts), driven by the live listing-driven section engine + admin controls, with the
4-ID chain intact and Eat → the agreed Category landing. Start with **Home**, go screen
by screen, close each screen's data gap (esp. the offer-source fix for Offers), verify
each against its HTML mockup, ship via OTA.
**Then:** resume §3 — the deferred other-business listings (drill-down taxonomy engine
first), reusing the now-proven listing→section→follower pipeline.
