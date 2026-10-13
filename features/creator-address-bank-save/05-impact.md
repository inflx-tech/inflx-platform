# Impact Analysis — delivery address, bank details, Save

## In one line
A creator keeps one delivery address that fills her Remote collab form; her bank account asks for
all INFLX needs to pay her; Save closes the screen first time. One additive migration; no money moves.

## What exists · what changes · what is built
**Exists.** No street address on a creator's profile; she types one into each Remote collab. Bank
account = number + IFSC. On six screens Save is followed by "Discard changes?".

**Changes.** She keeps an address in her profile (private to her) and each Remote collab starts
from it. Her bank account has the holder's name, the number typed twice, the IFSC, the bank and the
branch, and INFLX sees all of it when paying. Save needs one tap.

**Built.**
- Database — migration 208 (additive): table `creator_delivery_addresses`; `influencers.
  bank_holder_name / bank_name / bank_branch`; `withdrawal_requests.bank_name / bank_branch`.
- Server — `services/creatorAddress.service.js` + `routes/creatorAddress.routes.js` (new);
  `controllers/influencer.controller.js` (the bank entry, and three more fields never sent back);
  `services/remoteShoot.service.js` (prefill); `services/remoteAddress.service.js` (the tick);
  `services/withdrawalRequest.service.js` (the request's copy, admin's read); `routes/index.js`.
- Creator app — `screens/influencer/DeliveryAddressScreen.js` (new), `ProfileScreen.js` (row),
  `RemoteAddressScreen.js`, `PayoutDetailScreen.js`, `CreatorWalletScreen.js` (the row's subtitle),
  `components/profile/addressBankCopy.js` (new), `navigation/InfluencerNavigator.js`,
  `services/api.js`.
- Both apps — `hooks/useUnsavedGuard.js` and its six callers (`ProfileInfoScreen`,
  `NicheLanguagesScreen`, `BrandBusinessDetailsScreen`, `BrandLinksScreen`,
  `BrandSubCategoriesScreen`, `BrandBranchEditScreen`).
- Website (INFLX admin) — `brand-web/app/admin/money/withdrawals/page.js`: Bank, Branch, and the
  bank beside the name in the list.

## Affected routes / APIs
- NEW `GET / PUT / DELETE /v1/influencers/me/delivery-address` — creator only.
- `PATCH /v1/influencers/me` — a bank save now needs `bank_holder_name, bank_account_no,
  bank_account_no_confirm, bank_ifsc, bank_name, bank_branch`. Before: `bank_account_no` and
  `bank_ifsc`, each saved on its own.
- `GET /v1/influencers/me/invitations/:ciId/remote` — `shoot.prefill` gains `street, pincode,
  stateName, cityName, note` (when she keeps an address) and always `fromProfile`.
- `POST …/remote/address` — optional `keepInProfile: true`.
- `GET /v1/admin/money/withdrawals[/:id]` — rows gain `bankName`, `bankBranch`; `payeeName` is the
  account holder's name on a bank request made after this.

## Affected workflows (regression surface)
- Item 11 Remote: her address, send, lock, correct, the brand's read — `item11-remote-flow`,
  `item11-phase2a`, `item11-remote-return`, `remoteScreens.test.js`, `cancelWhileBusy.test.js`.
- Item 17 Wallet: withdraw, admin Money — `item17-wallet`, `wallet17.test.js`.
- Registration and profile: `registration-profile`, `registrationProfile.test.js`,
  `item3Creator.test.js` (two bank tests rewritten to the new rule — business-rule drift).
- Every screen with the Save strip — `saveBarScreens.test.js`, `creatorStrips.test.js` (their two
  inventories gain the new screen, as they are built to demand).

## Privacy
- The kept address is on its own table because the creator row is read whole in seven places that
  answer other people. No route reads it for anyone but her; a brand is refused, admin has no route.
- Holder name, bank and branch are stripped from every response, like the account number.
- The profile row shows city and pincode, not the street.

## Migration / deploy / OTA impact
- Migration 208 BEFORE the push (the new server reads the new columns on every withdrawal options
  call and every Remote read).
- Push → Render (server) and Vercel (admin Money page).
- OTA: influencer (all three pieces) and brand (Save on four screens). Follower: not published.
- No native change, no new app build.
- Between the push and the OTA an older creator app cannot save a bank account (told which box is
  missing); nothing else is affected. Publish the influencer OTA straight after the server is up.

## Rollback
Revert the commit and push; republish the previous influencer and brand bundles. Migration 208 can
stay (unused columns and an unused table harm nothing); kept addresses and the three bank words
would simply be ignored by the older server.

## Risk notes
- **Money:** none moves. A bank withdrawal made after this is addressed to the name she typed on
  the account instead of her profile name — which is what the bank checks.
- **A creator with an account saved before this** still withdraws; INFLX sees her profile name and
  no bank or branch for that request, as it does today.
- **The courier check is not made on the profile address.** A kept pincode a courier cannot reach
  is caught on the Remote form, as a typed one is today.
- **The first account-number box hides its digits.** A mistake there is caught by the second
  typing, which is the point; it does cost her a retype.
- **Not seen on a phone.** Proved by tests on the real navigator and the real API only.
