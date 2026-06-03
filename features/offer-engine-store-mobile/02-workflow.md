# Workflow Definition — offer-engine-store-mobile (D3b)

## Actor
A **follower** (mobile) opening a brand store that has a published store offer.

## Preconditions
- D1 (store_offers surfaced) + D2 (store-direct endpoints) live. Brand has an
  active `published_to_store` offer.

## Workflow steps (user-observable)
1. Follower opens the brand store → a **"Store Deals (N)"** tab appears (only when
   store offers exist).
2. Tapping it lists each brand-direct offer (name + discount summary + "store deal").
3. Tap **Buy →** → PayAtStore screen (store-direct mode).
4. Follower enters the bill amount → pays via Razorpay → backend computes the
   discount, **zero commission**, writes the store-direct transaction.
5. Receipt shows the reference code + net amount. No influencer credited.

## Success definition
A follower can discover and buy a brand-direct store offer; the purchase goes
through `/follower/store-offer/pay+verify` (no influencer/tracking, no
commission); the influencer purchase path + existing store tabs are unchanged.

## Failure / edge workflows
- No store offers → tab hidden; store unchanged.
- Unavailable/cross-brand offer → backend 409 surfaced via Alert.
- Payment cancelled → returns to confirm step (existing behaviour).

## Verification note
Maestro E2E (`qa/maestro/flows/05-follower-store-deal.yaml`) to be run on a
connected device post-merge (gate overridden at merge per founder authorisation).
