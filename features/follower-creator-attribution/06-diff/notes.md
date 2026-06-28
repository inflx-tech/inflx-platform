# 06 — Before / after notes

## Slice 1 — Per-line claim (mobile only)

**Before:** the creator tag lived at **cart level** (one per cart). A multi-brand
cart attached it only to the lead brand; a second creator (or a second creator on
the same brand) was dropped to organic or overwrote the first → only one creator
ever got credited.

**After (`04-preview/mockups/cart-multi-creator.html`):** the claim lives on the
**LINE**. Each item added from a creator's store/link is stamped with that
creator's `claim { campaign_influencer_id, campaign_id, set_id, offer_id, source,
creator_handle }`; organic adds carry `null`. At checkout the cart groups by
**(brand + claiming creator)** and sends one `brand_group` per group, so each
creator is credited only for the items they drove and organic items stay organic.
The follower still sees ONE flat list + ONE bill.

## Delivered
- `services/CartContext.js` — `buildClaim(tracking, extra)`; `addItem` /
  `forceReplaceWith` stamp the per-line claim and fold the claiming creator into
  the `line_key` (same product via two creators → two distinct lines).
- `screens/follower/CartScreen.js` — `placeShopOrder` groups by (brand + creator)
  from line claims → `brand_groups` (or the legacy single payload when one group);
  each item shows a subtle **"via @creator"** pill, organic items show
  **"Added by you."**
- **Backend:** none — `placeOrder` already prices each `brand_group`
  independently and `verifyOrder` already loops `sub_orders`; two groups for the
  same brand with different creators already work.

## Verification
- mobile jest **20/20** (FollowerWallet baseline excl.); CartScreen transforms
  clean. `pnpm qa` unaffected (no backend change).
- Live-verify on [FTW]: add items from two different creator stores (+ one organic
  item) → one bill → Place Order → Orders shows one order per (brand+creator),
  each creator credited for their items only.

## Slice 2 — Code door (`cart-code.html`)

**Before:** a creator could only be credited via their link/store; a code typed at
checkout did nothing (no UI, no resolution).

**After:** a **"Have a creator code?"** field in the cart. On apply, the code
resolves to the creator and stamps a `source:'code'` claim on **that creator's
allocated products for that brand only** — other items stay organic, and a line
already claimed via link is not overridden. The bill shows the creator's discount;
the follower still pays once and the per-(brand+creator) split (Slice 1) credits
the creator.

## Delivered (Slice 2)
- Backend `follower.controller.js` (+`resolveCoupon`) + `follower.routes.js`
  (`POST /follower/resolve-coupon`, follower auth): code → creator, validated
  (contracted/active CI, live campaign, has a shoppable offer), returns
  `{ campaign_influencer_id, campaign/set/offer ids, brand_id, creator_handle,
  offer:{type,label,discount_type,value,max_discount}, allocated_product_ids }`.
  Reuses `followerService.allocatedProductIds`.
- Mobile `services/api.js` (+`resolveCoupon`); `services/CartContext.js`
  (`applyCreatorCode`/`clearCreatorCode` — stamp/clear the code claim on allocated
  lines, re-key line_key); `screens/follower/CartScreen.js` (code field empty →
  applied chip, error states, bill discount line + savings preview).

## Verification (Slice 2)
- backend loads; `pnpm qa` (see deploy); mobile jest **20/20** (FollowerWallet
  baseline excl.). Live-verify: type a creator's code on a cart holding that
  creator's allocated product → discount + attribution; non-allocated/other-brand
  items unaffected; Orders shows the creator credited.

## Slice 4 — Post-order notify (backend only)

**Before:** on an online order, only the follower got `order.confirmed`. The
creator was credited silently (no "₹X earned" ping — that fired only on
pay-at-store) and the brand got nothing (had to poll the fulfilment page).

**After:** `verifyOrder` (per-sub loop) now also notifies, all at once:
- **Creator(s)** — `commission.sale` "₹X earned", aggregated per distinct creator
  across their sub-orders (reuses the pay-at-store pattern; FCM, no SMS).
- **Brand(s)** — `order.placed` "New order received", deduped per distinct brand.
- Follower `order.confirmed` + follow-creator prompt unchanged.

## Delivered (Slice 4)
- `transaction.controller.js` — `prepareSubOrder` returns the brand `user_id`;
  `writeSubOrder` returns `commissionAmount`/`couponCode`/`brandUserId`;
  `verifyOrder` sends the creator + brand pings. No schema, no mobile change.

## Verification (Slice 4)
- backend loads; `pnpm qa` green (see deploy). Backend-only → no OTA. Live-verify:
  place a creator-attributed order → creator gets "₹X earned", brand gets "New
  order received", follower gets "Order confirmed".

## Slice 3 — Link door (Way 1: the creator's social link)

**Before:** a creator's `inflx.in/s/{handle}?cid&sid&oid&iid` link opened a
browser/web fallback — the app had no deep-link handler, so the tag was lost on
entry and Way 1 was dead on the installed app.

**After:** the app catches the link (cold start + warm) and opens the creator's
store carrying the tag; adding a pick there is credited via the per-line claim
(Slice 1). Also handles `/b/` (brand store) and `/p/` (product); `/o/` deferred.

## Delivered (Slice 3)
- `src/navigation/navRef.js` — navigation ref + `navigateWhenReady` (handles a
  cold-start link firing before the tree mounts).
- `src/utils/deepLink.js` — `parseDeepLink` (host/scheme strip → type + id +
  4-id tracking) + `handleDeepLink` (routes to InfluencerStore/BrandStore/
  ProductDetail). `src/utils/__tests__/deepLink.test.js` (5 tests).
- `App.js` — `NavigationContainer ref`; `Linking.getInitialURL` + `'url'` listener
  (follower flavor only).
- **Native (APK):** `android/app/src/main/AndroidManifest.xml` — App-Links
  intent-filter for `inflx.in` (`/s//b//p//o/`) + the `inflx://` custom scheme.

## Slice 5 — Way-4 window credit (Parts 1 + 2)

**Before:** the 30-day attribution window (`attribution_clicks`) only lowered
INFLX's platform-fee tier on a later organic buy — it credited the original
creator **₹0**. And the window opened only on a creator-mediated *purchase*, not
on a click.

**After (Part 1 — credit):** a PURE organic buy (no store offer) now checks the
window in `priceOrderForGroup`; if an unexpired click ties this follower+brand to
a creator with a live commissioned CI, the buy is attributed to that CI (most
recent window = last-click) — the creator earns commission on the net (no
discount, since the follower didn't apply the offer). Reuses the normal credit
path (`writeSubOrder` → `pending_balance` → return-window cron) + Slice-4 ping;
the order shows in the creator's basket. No schema change.

**After (Part 2 — click opens window):** `recordTouch` (`POST /follower/touch`)
now resolves the influencer + brand from a deep link's `campaign_id` /
`campaign_influencer_id`, and `InfluencerStoreScreen` calls it when the follower
arrives via a tracked link — so a *click* opens the window (anonymous/unauth
touches fail silently → fall back to purchase-opens-window).

## Delivered (Slice 5 Parts 1+2)
- `transaction.controller.js` `priceOrderForGroup` — window lookup
  (attribution_clicks ⨝ live CI) → `record.attributed_ci` + commission_pct; subMeta
  stamps the attributed CI so the existing credit path pays the creator.
- `follower.controller.js` `recordTouch` — resolve brand/influencer from cid/iid.
- `services/api.js` (+`recordTouch`); `InfluencerStoreScreen` touch-on-arrival.

## Verification (Slice 5 Parts 1+2)
- backend loads; `pnpm qa` (see deploy); mobile jest **25/25** (FollowerWallet
  baseline excl.). Live-verify: buy via a creator once (opens window) OR click
  their link (opens window) → later buy that brand organically within 30 days →
  the creator is credited + pinged.

## Slice 5 Part 3 — Admin-configurable window duration (migration)

**Before:** the attribution window was hardcoded `now() + interval '30 days'` in
6 write sites.
**After:** `payment_config.attribution_window_days` (migration 120, default 30) is
admin-editable on **/admin/settings/payments** ("Creator Attribution Window
(days)"). All 6 window writes now use `now() + make_interval(days => $N)` from the
config (validated integer; graceful fallback to 30 if the column is absent, so it
degrades safely pre-migration).

## Delivered (Part 3)
- `backend/migrations/120_attribution_window_days.sql` + `scripts/run-120.js`
  (prod apply; additive `ADD COLUMN IF NOT EXISTS … DEFAULT 30`).
- `paymentConfig.service.js` — read/fallback/allow-update `attribution_window_days`.
- `transaction.controller.js` — `attributionWindowDays()` helper; 4 window writes
  parameterised. `follower.controller.js` — `recordTouch` 2 writes parameterised.
- `admin.controller.js` `updatePaymentConfig` + `admin/settings/payments/page.js`
  — the admin number input.

## Verification (Part 3)
- backend loads; migration applied to local dev DB (= 30); `pnpm qa` (see deploy).
- **Migration:** apply `run-120.js` to prod FIRST (migrate-first), then deploy.

## Verification (Slice 3)
- mobile jest **25/25** (FollowerWallet baseline excl.) incl. 5 parser tests; App
  compiles. JS ships via OTA.
- **APK + infra dependency (flagged):** the manifest intent-filter activates only
  on the **next APK**; and https App-Links open the app directly only once a
  `/.well-known/assetlinks.json` is hosted on inflx.in (otherwise Android shows an
  "open with" chooser). The `inflx://` scheme works without that.
