# Workflow Definition — referral-influencer-refer-earn (Contract 4)

> Mobile (influencer app) + 1 read endpoint. Steps are influencer actions →
> API/DB + screen assertions. Mobile-governed (Maestro boot smoke is the gate).

## Actor
Authenticated **influencer** in the RN influencer app.

## Preconditions
- C1 engine deployed (influencer-referrers settle inline).
- `GET /influencers/me/referral` deployed; influencer logged in.

## Workflow steps (observable)
1. Influencer opens **Earnings** tab → sees a **Refer & Earn** entry tile →
   taps it → navigates to **ReferAndEarnScreen** (in the Earnings stack).
2. Screen loads `GET /influencers/me/referral` → shows the influencer's
   **referral code**, **total earned** (hero), a short "how it works"
   explainer, and the **earnings ledger** (each accrual: referred name, source,
   amount, paid/pending, date).
3. Influencer taps **Copy** → code copied to clipboard (confirmation).
4. Influencer taps **Share** → native share sheet opens with the code + a short
   invite message.
5. (Elsewhere/later) someone they referred generates confirmed revenue → the
   engine credits the influencer's wallet + `referral_earned_total`; on next
   open the screen reflects the new total + a new ledger row.

## Success definition
- The screen renders the influencer's real code (stable across reloads),
  correct `earned_total` (= `influencers.referral_earned_total`), and a ledger
  matching `referral_ledger` rows for that influencer.
- Copy + Share work via the already-installed Clipboard + RN Share.
- Empty state (no referrals) renders cleanly (₹0, "share your code to start").
- The influencer app still **boots + bundles** with the new screen
  (`pnpm qa:maestro` → `02-influencer-launch` GREEN) — the mobile-verify gate.
- `pnpm qa` GREEN; backend referral endpoint jest GREEN; no regression.

## Failure / edge workflows
- API error → screen shows a retry state (existing mobile pattern), no crash.
- No code yet → lazily created on first GET; never blank.
- A JS error in the new screen → app fails the Maestro boot smoke → release
  blocked (the gate working as intended).
