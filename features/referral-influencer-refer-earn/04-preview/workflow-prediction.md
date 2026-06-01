# Workflow prediction — referral-influencer-refer-earn (Contract 4)

## Trigger
Influencer taps **Refer & Earn** (entry tile on the Earnings tab) in the RN
influencer app.

## Steps
1. ReferAndEarnScreen loads `GET /influencers/me/referral`.
2. Shows: earned hero (₹ total + active-referral count), referral code with
   **Copy** + **Share**, "how it works" explainer, and the earnings ledger.
3. Copy → clipboard; Share → native share sheet with code + invite message.
4. As referred entities generate revenue, the engine credits the influencer's
   wallet + `referral_earned_total`; the screen reflects it on next load.

## End state
- Influencer can see + share their code and see exactly what they've earned and
  from whom.

## Edge cases
- No referrals yet → ₹0 hero, "Share your code to start earning" empty ledger.
- No code yet → lazily created on first GET (stable after).
- Network error → retry state (existing mobile pattern).
- Logged out → app's normal auth gate.

## What changes vs current behaviour
- Today: the engine credits influencer-referrers, but there is NO screen to see
  the code, share it, or see referral earnings.
- After: a Refer & Earn screen in the Earnings stack + an entry tile.
- Files: backend `getReferralInfo` + `GET /influencers/me/referral`; mobile
  ReferAndEarnScreen + InfluencerNavigator + EarningsScreen tile + api client.

## Blast radius
- Production-impacting: Render (1 read GET) + OTA to installed influencer apps.
  No migration, no native rebuild, no money-path change.
- Mobile-verify gate ENFORCED: `release.maestro_green` required (boot smoke).
- Rollback: OTA republish prior bundle + remove endpoint. Nothing persisted.
- Affected users: influencers (the influencer app) only.

## Open questions
- None blocking. Scope delegated ('start implement … mobile'). Redemption
  ("enter a code") UI for referred users is out of scope (shared w/ C3b). Mockup
  in `mockups/` is the review artifact for mockup-lock.
