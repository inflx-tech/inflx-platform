# 06 — Diff Notes: prod-verify fixes

Four founder-reported bugs from device testing (OTA v118), root-caused in code + fixed.

## Implemented
1. PDP only name+price → new `GET /follower/products/:id` (full row incl. `facets`);
   plain-tap path fetches + merges; new **Product Details** spec block (facets + section
   + returns) + existing description.
2. 3 images not showing → swipeable hero **carousel** from `image_url` +
   `variants_json.cover_images[]` + selected colour `images[]` (deduped) + page dots.
3. Pay-at-Store on fashion PDP → removed: `CATEGORY_CTA_ORDER` fashion/furniture =
   `['online_order']` → single Add-to-Cart CTA (matches locked mockup).
4. "Session expired" on save address → `FollowerLoginScreen` now persists
   `inflx_refresh_token` (both login paths) so the API client refreshes the 15-min
   token silently. Fixes ALL follower writes after 15 min.

## Verification
- backend `node --check` clean (controller + routes).
- `pnpm qa` GREEN gate 0 (mobile inert; backend endpoint additive).
- OTA bundle (metro) compiles. Founder device re-verify before released=true:
  open product (full detail + swipe images + single Add-to-Cart) → cart → checkout →
  add+save address (no session-expired) → place order.

## Note
facets renders defensively (object key→value; arrays joined); products with empty
cover_images fall back to the single image (no empty carousel).

## Round 2 (founder device feedback on v119)
- Images were stored in `facets.images` (not variants_json.cover_images) → carousel now
  sources `facets.images` too; `images`/`size`/`colour`/`category` keys hidden from the
  Product Details spec rows (FACET_HIDE) so they're not dumped as text.
- Colour selector → small round **swatches** (filled via COLOUR_HEX, name below, ring when
  selected); Size selector → small round **circles** (gold fill when selected) — replaces
  the full-width boxes (founder: "round small circles in color as well as sizes").
- LOGOUT was broken (cleared tokens but never navigated; FollowerLogin not in ProfileStack)
  → registered FollowerLogin in ProfileStack + MeScreen navigates to it on logout. This also
  unblocks the session-expired recovery: logout → re-login stores the refresh token.

## Round 3 — PLACE ORDER did nothing / app exited / 0 orders (critical money path)
ROOT CAUSE: the online-order `createOrder` response OMITTED `razorpay_key_id` (pay-at-store
/prebook include it). The app called `RazorpayCheckout.open({key: undefined})` → native
hard-crash (bypasses JS try/catch) → app exits, no payment, no order. (Same endpoint →
also broke the restaurant cart cutover.)
FIX: (1) backend transaction.controller online-order response now returns
`razorpay_key_id: txService.getRazorpayKeyId()`. (2) app `processPayment` guards: if no key
OR a mock order id (`order_mock_…`, prod is RAZORPAY_MOCK=true) → use the simulated confirm
directly instead of handing a fake order to the native SDK. Real key + real order → real
Razorpay sheet. NOTE: prod RAZORPAY_MOCK=true → orders complete via the mock confirm
(simulated pay) and a real order + commission ARE written; flip RAZORPAY_MOCK=false + live
keys for real charges.
