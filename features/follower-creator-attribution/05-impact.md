# 05 — Impact

**Verdict:** additive attribution correctness + two new entry doors. No schema
change expected (reuses `campaign_influencers`, `attribution_clicks`,
`follower_transactions`). One new read endpoint (`resolve-coupon`); cart claim
model moves cart-level → per-line.

## Surfaces
- **Slice 1:** mobile `services/CartContext.js` (per-line `claim`), `screens/follower/CartScreen.js` (group by brand+creator), add-sites already pass tracking. `__tests__/CartScreen.test.js` updated. Backend: none expected.
- **Slice 2:** backend `follower.controller.js` (+`resolveCoupon`), `follower.routes.js` (+route); mobile `CartScreen.js` (code field + apply). Reuses `validateTracking` + offer parser.
- **Slice 3:** mobile `App.js` / navigation linking config (`Linking`); native `android/app/src/main/AndroidManifest.xml` intent-filter (**APK**, not OTA).
- **Slice 4:** backend `transaction.controller.js` `verifyOrder` (creator `commission.sale` + brand `order.placed`); reuses `notification.service.js`.

## Deploy
- Slices 1, 2, 4: **production-impacting** — backend → Render, mobile → OTA. No migration. Surfaced for go.
- Slice 3: JS via OTA; the manifest intent-filter activates on the **next APK** (flagged, like VIBRATE). `release.released` stays false (no Maestro).

## Risk
- Low–medium. Single-brand/single-creator + organic paths must stay byte-identical
  (food + existing creator flow). Per-line claim is additive; cart-level fallback
  preserved. Code door is a new opt-in field; deep-link routing is guarded.
