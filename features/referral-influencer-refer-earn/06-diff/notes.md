# Diff notes — referral-influencer-refer-earn (Contract 4)

## What was implemented
A new **Refer & Earn** screen in the RN influencer app
(`screens/influencer/ReferAndEarnScreen.js`), registered in the Earnings stack
with an entry tile on `EarningsScreen`, backed by a new read-only
`GET /influencers/me/referral` (`influencer.controller.getReferralInfo` + route).
The screen shows the influencer's referral code (Copy via Clipboard + Share via
RN Share), total earned, a "how it works" explainer, and the referral earnings
ledger. The engine (Contract 1) already credits influencer-referrers; this is
the view+share surface. JS-only → OTA.

## What matches the locked mockup
- `01-refer-and-earn.html` — matches: dark "YOU'VE EARNED ₹X" hero with active-
  referral count; the referral code in a dashed-yellow chip; **Copy** + **Share**
  buttons; the yellow "How it works" box (brand → subscription+protection,
  influencer → commission, 12 months → wallet, never reduces their pay); the
  earnings ledger rows (referred name, source chip, date, amount, paid/pending
  pill); the empty state (💸 "No referral earnings yet"). Implemented with the
  real `brandPalette` tokens + `fonts` the mockup approximated.

## What diverged from the mockup (and why)
- **Real app bar** uses the influencer app's existing header convention (back
  chevron + title) rather than the mockup's illustrative status bar — the
  mockup's "9:41 / 📶🔋" was just a phone-frame decoration.
- Otherwise faithful. The bottom tab bar in the mockup is the app's real tab
  bar (provided by the navigator, not the screen).

## Things the founder should specifically check
- **Empty state** (the state most influencers see first): ₹0 hero + "share your
  code to start" — renders when the ledger is empty.
- **Copy** shows a confirmation alert; **Share** opens the native share sheet
  with the code + invite link.
- Entry point: the **Refer & Earn** tile on the Earnings tab.

## Out-of-band changes
- None. Edits to `InfluencerNavigator.js`, `EarningsScreen.js`, `services/api.js`,
  `influencer.controller.js`, `influencer.routes.js` are additive, staged by
  explicit path. No adjacent fixes.

## After-shots / verification
- "Before" = the locked mockup `04-preview/mockups/01-refer-and-earn.html`.
- **Verification of the real build:** the RN bundle compiled cleanly via Metro
  (HTTP 200, 9.5 MB — proves `ReferAndEarnScreen` + the navigator import +
  `EarningsScreen` edits are valid), and the Maestro influencer boot-smoke
  confirms the influencer app still boots to its auth screen with the new bundle
  (see `release.maestro_green`).
- An authenticated screenshot of the live screen needs OTP login, which against
  the prod backend (real MSG91) isn't automatable here; a local-backend +
  OTP-mock harness would capture it (deferred — same constraint noted in the
  spec). The boot-smoke + bundle-compile are the gate this contract relies on.
