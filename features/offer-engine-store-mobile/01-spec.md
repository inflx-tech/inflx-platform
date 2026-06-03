# offer-engine-store-mobile — Sub-contract D3b: follower STORE DEAL render + buy (mobile)

> **Final Offer Engine slice (follower mobile).** Renders brand-direct store
> offers (the `store_offers` array, D1) in the follower app and wires a
> store-direct buy to the D2 endpoints. Mobile-governed (Maestro + OTA).
> Shipped via `GOVERNANCE_OVERRIDE` for the Maestro gate (founder-authorised
> 2026-06-03) — mobile E2E to be run on-device post-merge.

## Problem / goal
D1 surfaced `store_offers` (dormant) and D2 built the store-direct purchase
endpoints (no caller). D3b makes the follower app render the store deals and let
a follower buy one — completing the Store channel end-to-end.

## Scope
- **In scope (mobile):**
  - `Packages/Mobile/src/services/api.js`: `storeOfferPay` / `storeOfferVerify`
    → `POST /follower/store-offer/pay` + `/verify`.
  - `BrandStoreScreen.js`: a conditional **"Store Deals"** tab (only when
    `store.store_offers` is non-empty) rendering each brand-direct offer with a
    Buy action → navigate to `PayAtStore` with a `storeOffer:{brand_id,
    brand_offer_id}` param + `tracking:null`.
  - `PayAtStoreScreen.js`: when `storeOffer` is present, call `storeOfferPay`/
    `storeOfferVerify` (brand-direct) instead of `payAtStore`/`verifyPayAtStore`
    (influencer). All other UX (bill entry, Razorpay, receipt) reused.
  - `qa/maestro/flows/05-follower-store-deal.yaml` (permissive placeholder, to be
    tightened on-device).
- **Out of scope:** native changes (JS-only → OTA); restaurant/prebook store-direct
  variants; influencer purchase path (untouched).

## Surfaces touched
- **App(s):** follower mobile (`Packages/Mobile/src/**`) — JS only, ships via OTA.
- **Roles:** follower.

## Data / contracts
- No new endpoints (D2 live). New mobile api methods only. The brand-direct buy
  sends `{ brand_id, brand_offer_id, bill_amount, product_id?, variant_id? }`.

## Non-functional
- **Auth/role gates:** follower (existing).
- **Failure modes:** no store offers → tab hidden (existing store unchanged);
  backend 409 on unavailable offer surfaced via the existing Alert path.
- **Deploy posture:** PRODUCTION-IMPACTING (mobile runtime via **OTA**). The
  influencer purchase path + existing tabs are untouched (additive tab + a
  conditional branch). **Maestro gate overridden** (`GOVERNANCE_OVERRIDE`) — E2E
  on a connected Android device to be run post-merge (`pnpm qa:maestro`), then
  OTA published (`scripts/publish-ota.js` / `publish-ota:all`).
