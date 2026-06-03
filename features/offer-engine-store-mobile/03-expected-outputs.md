# Expected Outputs — offer-engine-store-mobile (D3b)

## Files changed
- `Packages/Mobile/src/services/api.js` — `storeOfferPay` / `storeOfferVerify`.
- `Packages/Mobile/src/screens/follower/BrandStoreScreen.js` — conditional
  "Store Deals" tab + render block (Buy → PayAtStore with `storeOffer` param).
- `Packages/Mobile/src/screens/follower/PayAtStoreScreen.js` — `storeOffer`
  param + branch to `storeOfferPay`/`storeOfferVerify`; receipt reads
  `data.reference_code` (fixes both paths).

## Files created
- `qa/maestro/flows/05-follower-store-deal.yaml` — permissive placeholder flow.
- contract docs + `04-preview/mockups/04-store-preview.html` (Screen 04) + `06-diff/notes.md`.

## Behaviour (verifiable on-device)
- Brand store with published offers shows "Store Deals" tab → tap deal → buy →
  store-direct transaction (no commission), receipt shown.
- No store offers → tab hidden; influencer path unchanged.

## QA / proof of done
- Server side proven by D2 `offer-store-direct.test.js` (4/4): the endpoints the
  app now calls behave correctly (discount, zero commission, null tracking IDs).
- Mobile E2E: `pnpm qa:maestro` on a connected Android device — **to be run
  post-merge** (Maestro gate overridden at merge per founder authorisation).
- JS-only change → no native rebuild; ships via OTA.

## Release classification
**PRODUCTION-IMPACTING (mobile runtime via OTA).** Maestro gate overridden
(`GOVERNANCE_OVERRIDE`) at merge; on-device verify + OTA publish follow. Additive:
influencer path + existing tabs untouched.
