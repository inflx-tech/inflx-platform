# referral-influencer-refer-earn — Contract 4: influencer "Refer & Earn" (mobile)

> **Contract 4 of 4** in the Referral / Strategic-Partner-Agency feature.
> Builds on Contract 1 (engine, which already settles influencer-referrers
> inline). The influencer-facing surface: an influencer sees their referral
> code, shares it, and sees what they've earned. **Mobile-governed** (RN
> influencer app) — Maestro gate applies; ships via OTA.

## Problem / goal
The engine already credits an influencer-referrer's wallet when someone they
referred generates platform revenue (`influencers.referral_earned_total` +
`wallet_balance`), but the influencer has **no way to see or share their code,
or see those earnings**. C4 adds the "Refer & Earn" screen so influencers can
actually participate in the referral channel.

Locked model (unchanged): an influencer who refers a **brand** earns the
admin-set % of that brand's subscription + protection fee; who refers an
**influencer** earns % of that influencer's public-purchase commission; for 12
months; carved from the platform slice; one active referrer per referred entity.

## Scope
- **In scope:**
  - **Backend (additive, read-only):** `GET /influencers/me/referral` →
    `{ code, earned_total, window_months, referred_count, ledger:[{ referred_name,
    referred_type, source, base_amount, pct, amount, payout_status, created_at }] }`.
    Code via `referral.service.getOrCreateCode('influencer', influencerId)`;
    `earned_total` = `influencers.referral_earned_total`; ledger from
    `referral_ledger` (referrer_type='influencer', referrer_id=influencer) joined
    to resolve referred names. New `influencer.controller.getReferralInfo` +
    route.
  - **Mobile (RN influencer app, JS-only → OTA):**
    `screens/influencer/ReferAndEarnScreen.js` — referral code with **Copy**
    (`@react-native-clipboard/clipboard`) + **Share** (RN `Share`), the
    `earned_total` hero, a short "how it works" explainer, and the earnings
    ledger list (mirrors `EarningsScreen` styling/tokens). Registered in the
    **Earnings** stack (`EarningsStackNav`) + an entry tile on `EarningsScreen`.
    `influencerApi.getReferralInfo` added to the mobile API client.
  - **Maestro:** the existing `02-influencer-launch.yaml` smoke flow must stay
    GREEN with the new JS bundle (proves the app still boots + bundles — catches
    a bad import/crash in the new screen). `release.maestro_green` set after
    `pnpm qa:maestro` passes on the emulator with the influencer APK installed.
  - QA: jest for `GET /influencers/me/referral` (shape, code, earned_total,
    ledger, RBAC, empty); `pnpm qa` GREEN.
- **Explicitly out of scope:**
  - The **"enter a referral code"** UI for a *referred* user at/after signup
    (the redemption entry point) — the backend `POST /referrals/redeem` exists
    (C3a) but the signup UI is shared with **Contract 3b**. C4 is the
    **referrer** side only.
  - Agency mobile app → Contract 3b.
  - Any change to accrual math / wallet / withdrawal (all already exist).
  - A new authenticated Maestro flow that logs in + opens Refer & Earn — needs a
    local-backend + OTP-mock harness (prod OTP is real MSG91); deferred. The
    boot smoke flow is the gate this contract relies on.

## Surfaces touched
- **App(s):** RN mobile **influencer** app (`in.inflx.app.influencer`) + backend
  (1 read endpoint). No web, no agency app.
- **Roles:** influencer (authenticated) views their own referral info.

## Data / contracts
- No migration, no schema change, no money movement — reads existing tables.
- New endpoint (auth = influencer): `GET /influencers/me/referral`. Envelope
  `{success,data}`.
- Money rupees `numeric(x,2)`; the screen uses `fmtRupees` for display.

## Non-functional
- **Auth/role gate:** `requireRole('influencer')` (mirrors other `/influencers/me*`).
- **Failure modes:**
  - Influencer with no referrals yet → `earned_total=0`, `ledger=[]`,
    `referred_count=0` → screen shows the empty/"share to start" state.
  - Code lazily created on first GET (idempotent; stable thereafter).
  - Network error on the screen → existing mobile error/retry pattern.
  - Bad JS in the new screen → caught by the Maestro boot smoke (app fails to
    bundle/boot) → gate blocks release.
- **Deploy:** backend `git push` (Render) + **OTA** publish of the influencer
  JS bundle (`scripts/publish-ota.js influencer`). No native rebuild (no native
  modules added; Clipboard + Share already present).
