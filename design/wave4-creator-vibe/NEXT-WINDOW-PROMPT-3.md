# INFLX — FRESH-WINDOW HANDOFF v3 (offers + commission + follower-screen rebuild) — 2026-06-09

You are the chat-architect continuing ONE program on repo `C:\WORK\inflx-platform`.
Behave EXACTLY as the prior window: contract-driven, verify-twice, no-fake-green, surface
production deploys, stage git by path (shared tree / parallel windows), take best action on
delegated/design/lock decisions but never silently deploy. GOVERNANCE.md (charter) wins on
conflict; CLAUDE.md is the lean entry. Supersedes NEXT-WINDOW-PROMPT-2.md on everything below.

Founder is **non-technical** — communicate in plain functional language (what the user/follower
sees, what works, what's next), not jargon. The founder tests on a real device; you cannot.

---

## ⚡ THE ONE OPEN BUG (start here)
**The follower app's ORDERS tab crashes — silently closes the app, no error screen.** Unresolved
across 3 fix attempts this session. Current state: I rebuilt `OrderHistoryScreen` to a **minimal
crash-proof baseline** in **OTA follower v90** (removed the order tracker, removed the dynamic
`emojiFor()`/`getBusinessAccentLight` helper → static per-kind emoji + hardcoded tag colors,
guarded every field, tabs row `flexGrow:0`, wrapped in a new `components/ErrorBoundary`).
- A silent close with NO ErrorBoundary message ⇒ NOT a normal JS render error (boundary catches
  those) ⇒ either the device was still on the OLD bundle when tested, OR it's a **native-level
  crash** the JS boundary can't catch.
- **NEXT ACTION:** have the founder **fully kill the app (swipe from recents) + reopen** to load
  v90, then open Orders. If it works → re-add the live tracker carefully. If it STILL closes
  silently on confirmed-v90 → it's native; get the device crash log (adb logcat / Android crash
  dialog) or isolate further (the screen is already near-minimal — suspect the bottom-tab
  navigator, a native module, or fonts). Profile (MeScreen, similar rebuild) works fine.
- Secondary, cosmetic (NOT a bug): Offers tab shows oversized chips/cards for ~3s on **cold start
  only**, then snaps normal — that's the custom fonts (Fraunces/Plus Jakarta) loading on first
  launch. Self-corrects; low priority (pre-load fonts / splash to remove the flash).

---

## HARD INFRA / SANDBOX FACTS (verified this session — CARRY FORWARD, they change what you can do)
- **This machine CAN reach prod** via `backend/.env.prod-backup` (REAL Supabase:
  `aws-1-ap-northeast-1.pooler.supabase.com`). AND **`git push` works** (remote
  github.com/inflx-tech/inflx-platform reachable).
- **`src/config/env.js` IGNORES `ENV_FILE`** (it just `dotenv.config()` → loads `.env` = LOCAL
  docker `inflx_dev`). Only the `run-0XX.js` / standalone scripts that do
  `dotenv.config({path: ENV_FILE})` reach prod. So to query prod, use a script that explicitly
  loads `.env.prod-backup`, or set `process.env.DATABASE_URL` before requiring `config/db`
  (db.js auto-enables SSL when the URL contains `supabase.com`).
- **`pnpm qa` CANNOT run here** — the Jest/QA test DB is on `localhost:5544` (`inflx_test`,
  container not running in this sandbox). So: substitute the gate with (a) pure unit tests via
  standalone `node -e` assertions, (b) **read-only validation against LIVE prod data**, (c)
  Babel transform check (`node -e "require('@babel/core').transformFileSync(file,{configFile:'babel.config.js'})"`),
  (d) `node -e "require('./src/app')"` for backend load. NEVER claim qa green — record
  `qa_all_green: null` with an honest note.
- **OTA publish WORKS from here:** `npm run publish-ota:follower` / `:influencer` (token in
  repo-root `.env.ota`). Mobile JS = OTA; native changes need an APK (NATIVE_RUNTIME bump).
- **Render auto-deploys** backend (+ Vercel brand-web) on `git push origin main`. After a push
  that touches `backend/src`, Render redeploys and the OTA `/ota/publish` endpoint 502s /
  "fetch failed" / "terminated" mid-deploy → **wait for `GET /v1/follower/home` = 200, then
  retry publish** (idempotent; bundle rebuilds).
- Prod API base = `https://inflx-platform.onrender.com/v1` (api.inflx.in stale/404).
- **OTA versions now: follower = v90, influencer = v93. NATIVE_RUNTIME = '3'** (pure-JS changes
  only this session — no APK needed).
- **Next NEW migration = 095** (094 = influencer_store, APPLIED to prod + verified). Apply:
  `ENV_FILE=.env.prod-backup node backend/scripts/run-0XX.js`.
- **gov-check (pre-push hook):** Rule 1 = governed path (`backend/src/**`, migrations,
  `Packages/*/{src,app,...}`) needs an approved contract's `lock.json` in the changeset; Rule 3
  = UI-governed needs `mockup_locked`(+_by/_at) on the backing contract; Rule 4 = UI-governed
  needs non-empty `06-diff/notes.md`; Rule 5 = a Mobile-governed path flipping `released=true`
  needs `release.maestro_green===true` OR `GOVERNANCE_OVERRIDE="reason"`. **Maestro is
  founder-side (no emulator here) → every Mobile release used `GOVERNANCE_OVERRIDE="..."` (the
  standing, recorded pattern).** Release-evidence (Rule 2) wants `released_by`, `released_at`,
  `qa_all_green !== false` (use `null`), and a `deploy`/`result` block.
- **HEAD = `fbde461`** (all work pushed to `main`). Parallel-window git hygiene: shared tree —
  **stage by path, never `git add -A`** (untracked design/* + reels WIP belong to other windows).

---

## THE SPINE (unchanged)
Seller lists an entity (listing engine) → with no extra wiring it's rankable and appears in the
right admin-controlled follower shelf (section engine) with the right CTA (availing_modes) +
4-ID creator chain. "What you list == what you see."

---

## WHAT THIS SESSION SHIPPED (all LIVE on main/prod)

### A. Offer-source cutover (offers were dark → now live)
Root cause (code-verified): section offer shelves INNER-JOIN the **legacy, empty
`campaign_offers`** table; the REAL offers live on **`campaign_influencers`** (per-creator
SNAPSHOT `offer_type`/`offer_config_json` + `allocation` + `brand_offer_id` /
`promoted_brand_offer_ids`) and on **`brand_offers.published_to_store`** (store-direct).
- Built `backend/src/services/brandOffers.adapter.js` — normalized offer shape; **re-anchored on
  the ASSIGNMENT** (reads the ci snapshot, classifies by `allocation`, handles BOTH offer-type
  vocabularies + the capitalized `'Discount'` seen in real data) + store-direct + engagement
  showcase. `rankForRule` ranks per shelf. `toFeedItem` = the shape `sectionRules.mapOfferItem`
  emits.
- Wired all 10 offer rules in `sectionRules.service.js` to the adapter behind
  **`SECTION_ENGINE_OFFERS`** (env flag, `config/env.js`) — **defaults ON in prod**
  (supabase/NODE_ENV), OFF in test/dev; explicit env value wins (kill-switch = set 'false').
- VERIFIED LIVE: `/v1/follower/home` + `/v1/follower/section/offers` populated. Mig 084-086
  already on prod. Contract `features/listing-section-d0-seams` (Workstream B; A=taxonomy,
  C=availing-vocab-widen DEFERRED).

### B. Commission attribution (model + the new builds)
Locked model (founder terms) — see memory `project_commission_attribution_model.md`:
Path A = influencer-attributed (earns commission, smaller platform fee) · Path B = direct
(no commission, larger fee). Decision order **store > live-link > 30-day brand-scoped window
(last-click) > direct**. Single winner, paid once. Contract-matrix enforced at stock time.
- **Code reality (verified):** 3-tier fee asymmetry ALREADY live (`categories.path_a/b/c_pct`,
  per-brand override `commerce_commission_override_pct`); `classifyPath`(pricing.service) +
  30-day `attribution_clicks` window + last-click + commission pending→wallet cron + contract-
  gating ALL exist. DIVERGENCES: (1) window opens on first PURCHASE-via-link, NOT a click
  (link_clicks is anonymous); (2) code has 3 influencer tiers, model had 2 — **DECISION: keep 3**.
- **Founder's click insight (DECIDED + SHIPPED hybrid):** a logged-in app user who taps an
  influencer link / enters a store is NOT anonymous → app can record the click. Built
  **`POST /follower/touch`** (opens/refreshes the window for logged-in followers) +
  **`classifyPath` store-context branch** (store > live-link > window > direct, hijack-proof via
  `influencerStore.resolveStoreContext`) — both DORMANT (no client passes storeInfluencerId until
  wired). Contract `features/store-context-attribution`. Unit-tested 6/6.
- **Influencer stocking foundation** (mig 094, contract `features/influencer-store-foundation`):
  `influencer_store_inventory` table + `influencerStore.service` (contract-gate DERIVED from
  campaign_influencers DISTINCT brand_id where contracted) + 4 endpoints
  `/influencers/me/store/{items,stockable}` + `follower_transactions.via_store_influencer_id`
  column. Validated read-only on prod (sagartravel: 3 contracted brands → 69 stockable; anti-
  hijack returns null for non-stocked).
- **Stocking UI + pay-at-store store-context stamp** (contract `features/influencer-store-stocking`,
  OTA influencer v93 + follower v82): `StockStoreScreen` (+ "+ Stock" on MyStore); Creator Store
  pick → `via_store_influencer_id` → PayAtStore forwards → backend records it on the txn +
  applies store-context in computeL3.

### C. ALL 9 follower screens rebuilt to the locked mockups (`design/wave4-creator-vibe/*-comprehensive.html`)
(Each: full contract spec/workflow/impact + mockup-lock + 06-diff, OTA, released via override.)
1. Home ✅ · 2. Category ✅ · 3. **Offers** ✅ (OTA v80; hero + super-cat chips + sort pills +
   3 views) · 4. **Creator Store** ✅ (v81; gradient-ring hero/3 counters/Follow+Share/bio +
   My Store Collabs + category tabs → drill + product picks; FIXED to show PRODUCTS not offer
   cards) · 5. **Creator's Category** ✅ (v84; sub-type chips + partner brands + 2-col product
   grid + Top rail; Creator Store tabs navigate here) · 6. **Business Page (restaurant)** ✅
   (v85; RestaurantDetailScreen += action bar + "{Business} × Creators" row + trust line;
   checkout untouched) · 7. **Product Detail** ✅ (v86; rating row + conditional
   Customize(add-ons)/Variants(size) + running-total sticky bar; buy dispatch preserved) ·
   8. **Orders** ✅ but ⚠️ CRASHING — minimal baseline in v90 (see top) · 9. **Profile** ✅ (v87;
   profile card + stats + Wallet + Refer&Earn + menu) · Reels ❌ DEFERRED (no mockup; needs APK
   + native video).
- **Added `GET /follower/activity`** (additive read-only aggregator: follower_transactions +
  brand + via-creator + savings + order_status + booking) powering the Orders inbox.
- **`components/ErrorBoundary.js`** (new) — wraps Orders + Profile; shows the error message
  instead of crashing. Reuse it on risky screens.

### D. KEY ARCHITECTURE DIRECTIVES locked this session
- **Business Page + Product Detail are PER-VERTICAL + SCHEMA-DRIVEN.** CTA + blocks + product
  specs come from each vertical's `backend/public/schemas/<vertical>.json` (`availing_modes` /
  `card_config` / `actions` / `cta_primary`). 37 schemas exist. Build each vertical's business
  page + product specs **as that vertical's listing lands** (fashion → pay-at-store/order-online,
  salon → book, furniture → pay-at-store/order-online + furniture specs, etc.). Restaurant is the
  only one with live data + a dedicated screen (RestaurantDetailScreen) today. CTA is ALREADY
  schema-driven (ProductDetailScreen reads `offer.availing_modes` + category-aware verbs). Schema
  `availing_modes` is the DEFAULT; the brand's enabled set is the final CTA.
- **OFFER MECHANICS are a second, orthogonal axis** (offer_type) that composes with the vertical
  at the CART — see NEXT.

---

## ⏭️ THE NEXT TRACK (founder-requested): OFFER MECHANICS
Different offer types need offer-type-specific UI + cart composition + order display. The
**pricing engine `offer.service.computeOfferDiscount` ALREADY prices all 5 types**
(discount/volume/bogo/bundle/free_gift) over a cart AND returns `adjustments` + `reason`
("add the free item", "add N more bundle items") — but it **prices, it does NOT compose** (it
explicitly does not auto-add the BOGO free item). Build a single **shared offer-mechanic module
keyed by `offer_type`** (reused by every vertical), with 3 pieces:
1. `OfferBlock(offer)` — Product-Detail UI: discount badge · volume tier ladder · "Buy 1 Get 1" +
   the free item · "A+B+C for ₹Y (save ₹Z)" · "buy A → B free".
2. `composeCart(offer, pickedItem)` — acts on the engine's adjustments: BOGO auto-adds the get
   product @ ₹0 (qty-matched); bundle auto-adds ALL bundle products @ bundle price; free_gift
   adds gift @ ₹0; volume/discount = product lines.
3. `orderLines(order)` — render `follower_orders.items_json` lines with free/gift/bundle labels.
RULE to enforce (engine already implies it): volume/bogo/bundle/free_gift **require a CART →
only valid with `online_order`** (can't apply to a free-form pay-at-store bill); simple %/flat
work in any mode. Validate at offer-attach time. The Orders screen now exists to show lines.

## ⏭️ REMAINING for the FULL stocked-product COMMISSION TEST LOOP (see features/influencer-store-stocking/TEST-PLAN.md)
1. **Surface `influencer_store_inventory` in the follower Creator Store** — today `resolveStore`
   shows campaign offers, not stocked-only products. (read-path, low risk)
2. **No-live-link store purchase path + credit the store creator at their CONTRACT rate** —
   pay-at-store currently REQUIRES `campaign_id/set_id/campaign_influencer_id`
   (transaction.controller.js initiate gate). A purely-stocked product (no campaign offer) can't
   be bought + the creator's commission rate isn't auto-applied. THIS is the money-path build —
   build + prove on a LIVE test transaction (founder runs it), never blind-deploy money crediting.
3. **Order/prebook store-context** — only pay-at-store threads `via_store_influencer_id` today.

---

## TEST PLAN + READ-ONLY PROD TOOLS
- `features/influencer-store-stocking/TEST-PLAN.md` — the commission/store test steps.
- `backend/scripts/check-offer-data.js` — `ENV_FILE=.env.prod-backup node ...` → offer-engine
  migration state + brand_offers/CI-attach counts.
- `backend/scripts/check-store-sale.js` — latest follower_transactions with store-context +
  money breakdown (verify a test purchase credited the creator).

## PROD TEST DATA (verified)
- **Chaitanya Food Court** (restaurant, id 55a4e7ea-…): campaign "Campaign offer checking" =
  active; sagartravel CI = active, 10% commission + 10% discount, **6 products**, offer_type
  stored as **'Discount'** (capital). This is the live conversion offer (shows 0% earlier was a
  brand-set value=0 on a different attach).
- **Aveen food paradise**: 4 `published_to_store` offers (volume + a 10% discount "Biryani
  Offer").
- **sagartravel** (influencer 070418e5-…): contracted with 3 brands → 69 stockable products.
- `campaign_offers` = 0 rows (legacy). Real offers on campaign_influencers (snapshot) +
  brand_offers.

## GOTCHAS
- offer_type appears in THREE forms in real data: library vocab (discount/volume/bogo/bundle/
  free_gift), legacy inline vocab (flat/percentage/bogo/bundle/volume/prebook), AND capitalized
  'Discount' — normalize case-insensitively (the adapter does).
- RN style: **negative percentages crash** (`left:'-50%'` killed the Orders tab once). Avoid
  negative %; prefer flex layouts.
- exposed Places key (earlier window) — restrict/rotate. /internal/geocode-health +
  /places-health diagnostics can be removed.

## STEP 0 — READ FIRST
1. GOVERNANCE.md + CLAUDE.md. 2. THIS file. 3. memory: project_commission_attribution_model.md +
   project_follower_rebuild_framing.md (auto-loaded). 4. The mockups
   `design/wave4-creator-vibe/*-comprehensive.html`. 5. Contracts under `features/` (newest:
   listing-section-d0-seams, store-context-attribution, influencer-store-foundation,
   influencer-store-stocking, follower-{offers-screen,creator-store,creator-category,
   business-page-restaurant,product-detail,orders-profile}-rebuild).
VERIFY-TWICE: read the real file/route/migration before any "X exists/works" claim.

## DEPLOY CADENCE
build → contract (spec/lock/mockup-lock/06-diff) → validate (unit + prod-read + Babel; full
`pnpm qa` not runnable here) → commit by path → push (gov-check; `GOVERNANCE_OVERRIDE="reason"`
for Mobile releases) → migration if any (ENV_FILE=.env.prod-backup, announce) → publish-ota
(wait for backend 200 first) → record release in lock.json. Surface prod-impacting; never silent.
Founder is the on-device acceptance gate.
