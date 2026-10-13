# Feature Spec — a creator's delivery address, her bank details in full, and Save that saves

> Raised by the founder on 13 Oct 2026, with a screenshot of the creator app's Profile info screen
> showing a "Discard changes?" box:
> "In our creator app, we dont have detailed address gathering one … detailed address for creator
> for receiving parcels from brand while doing remote type collabration … first we ask a fixed one
> and this will populate there where creator enter the details of address where to deliver … this
> address we populate as default if she wants she change that … pls add separate one like contact
> details in profile. next bank details in wallet is only two things one is acct number and IFSC
> code … pls make that re enter of account number, branch and bank details as well to enter. next
> while saving any changes in profile first if i click on save button a popup with dicard and keep
> editing … if i click on keep editing and again if is click on save then only it is saving … pls
> remove this popup and make it save directly. resolve these three issues."

## Problem / goal
1. **Address.** A creator's profile holds her name, city and social accounts — no street address.
   The only place she types one is inside a Remote collaboration, from nothing, every time.
   **Goal:** she keeps one delivery address in her profile; the Remote form starts from it; she can
   still change it for one parcel.
2. **Bank.** Her bank account in the Wallet is two boxes: account number and IFSC. INFLX pays every
   withdrawal by hand from its own bank. **Goal:** the account number typed twice, the bank, the
   branch — and the name on the account.
3. **Save.** On a profile screen, tapping Save shows "Discard changes?"; Keep editing, Save again,
   and only then does the screen close. **Goal:** Save saves and closes, first time.

## Survey — what exists today (looked at)
| # | Capability | Verdict | Evidence |
|---|---|---|---|
| 1 | A street address on her profile | **Missing** | `ProfileInfoScreen.js`: name, bio, state, nearest major city, age, gender, email, handles. No table or column holds a creator street address outside a collaboration |
| 2 | Her address for a Remote collab | Works | `RemoteAddressScreen.js` → `POST /influencers/me/invitations/:ciId/remote/address` → `production_events.ship_to_*` (item 11). A snapshot, locked when sent |
| 3 | What that form starts from | Works, partly | `remoteShoot.service.js` `prefill`: name, login number, profile state and city. Street, pincode and note start empty |
| 4 | Her bank account | Works | `PayoutDetailScreen.js` kind `bank`: `bank_account_no` (encrypted) + `bank_ifsc`. `influencer.controller.js updateMe` saves each on its own — the pair is only checked on the phone |
| 5 | Bank name / branch / holder name / second typing | **Missing** | no column, no box. A withdrawal's `payee_name` is her profile name |
| 6 | What INFLX sees to pay from | Works | `withdrawalRequest.service.js adminShape` + `brand-web/app/admin/money/withdrawals/page.js`: To, Account, IFSC |
| 7 | "Discard changes?" on leaving with unsaved changes | Works | `hooks/useUnsavedGuard.js`, on React Navigation's `beforeRemove` |
| 8 | Save then close | **Broken** | six screens do `setDone(true); navigation.navigate(...)`. The screen leaves in the same breath, before the guard has re-read `done`, so the guard asks about a screen that has just saved. Reproduced on the real navigator: `hooks/__tests__/saveLeavesWithoutAsking.test.js` — 6 of 6 red before the fix. The earlier tests of these screens used a stand-in navigation whose listener never fired |
| 9 | Whole creator record handed out | Hazard | `SELECT i.*` in seven places (`follower.service.js`, `proposal.controller.js`, `transaction.controller.js` …). Anything private put on the `influencers` row travels with it — so the address is its own table |

## Scope
**In scope**
- Creator app › Profile: a new row "Delivery address" and its screen (keep, change, remove).
- Creator app › Remote collab › "Where should they send it?": arrives filled from the kept
  address; a line saying so; when she keeps none, a tick "Keep this address in my profile for next
  time".
- Creator app › Wallet › Payment details › Bank account: six boxes — account holder name, account
  number, re-enter account number, IFSC, bank name, branch.
- INFLX admin › Money › Withdrawals: the name on the account, the bank and the branch on a bank
  request.
- Save without "Discard changes?" on every screen that had the fault: Profile info, Niche &
  languages (creator app); Business details, Links, What you sell, Add/Edit branch (brand app).

**Explicitly out of scope**
- The brand app's and the website's bank form (still account number + IFSC). Offered to the founder.
- Checking a bank account against the bank, or filling the bank and branch from the IFSC.
- Making the address a condition of approval, or of accepting a Remote collab.
- The label "Your nearest major city" (an open question with the founder since 8 Oct).
- Her sizes: still asked on each Remote collab.

## Surfaces touched
- App(s): mobile (influencer; brand for the Save fix only), brand-web (admin Money page), backend.
- Roles involved: creator, brand (Save fix), admin with Money.

## Data / contracts
- Migration 208 (additive): table `creator_delivery_addresses` (one row per creator); columns
  `influencers.bank_holder_name / bank_name / bank_branch`; `withdrawal_requests.bank_name /
  bank_branch`.
- API: `GET / PUT / DELETE /v1/influencers/me/delivery-address` (new). `PATCH /v1/influencers/me`:
  the bank entry is five parts plus the second typing, saved whole. `GET …/remote` `prefill` carries
  the kept address and `fromProfile`. `POST …/remote/address` accepts `keepInProfile`.
- Money: none moves. A withdrawal request copies three more words about where it is to be paid.

## Non-functional
- **Private.** No route returns another creator's kept address — not to a brand, not to admin. It
  is not on her profile record. Her bank holder name, bank and branch are never sent back to any
  screen, like the number.
- **Two addresses that never write to each other.** The kept address and an address sent to a brand
  are separate; changing either leaves the other alone. (One exception she chooses: the tick, which
  only ever fills an empty profile.)
- **An old app on the new server** cannot save a bank account (it sends two of six parts) and is
  told which box is missing; everything else it does is unchanged. **A new app on the old server**
  shows the Remote form as before and the Profile row as "not added".
- **Accounts saved before this** keep working: they still withdraw, under her profile name.
