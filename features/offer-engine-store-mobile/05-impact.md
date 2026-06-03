# Impact Analysis — offer-engine-store-mobile (D3b)

## Verdict (terse)
**Additive mobile UI + a conditional buy branch — influencer path untouched.**
A new tab that only appears when store offers exist, two new api methods, and a
`storeOffer`-gated branch in PayAtStore. No native change (OTA JS).

## Mechanics
- **"Store Deals" tab is conditional** (`store.store_offers.length > 0`). Stores
  without published offers render exactly as today.
- **PayAtStore branch is opt-in.** Only when `route.params.storeOffer` is present
  does it call `storeOfferPay`/`storeOfferVerify`; the existing influencer
  pay-at-store call is byte-unchanged otherwise. Bill entry / Razorpay / receipt
  are shared.
- **api methods are additive** (two new functions; existing ones untouched).
- **Reuses the D2 backend** (live, tested 4/4) — the app is a thin caller; the
  money math, zero-commission, and null-tracking invariants are enforced server-side.
- **Receipt fix** (`data.reference_code` first) improves both store-direct and the
  existing pay-at-store receipt (previously fell back to a generated code).

## Blast radius if it failed
Confined to the new tab + the store-direct branch. The influencer purchase path,
other tabs, and all non-store flows are unaffected. **However:** mobile E2E was
NOT run pre-merge (Maestro gate overridden) — so runtime confidence rests on
careful mirroring of the existing pay-at-store flow + the green D2 server tests,
not an on-device pass. On-device `pnpm qa:maestro` + manual smoke is the
follow-up before/with the OTA publish.

## Regression guard
D2 `offer-store-direct.test.js` 4/4 (server). Mobile change is additive + opt-in;
existing pay-at-store path unchanged. **Maestro E2E pending on-device** (override).

## Deploy posture
PRODUCTION-IMPACTING (mobile via OTA). Pushed with `GOVERNANCE_OVERRIDE` (Maestro
gate); `release.maestro_green=false`. OTA publish (`publish-ota:all`) + on-device
verify are the immediate follow-ups.
